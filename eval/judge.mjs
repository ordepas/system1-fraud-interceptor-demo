// Juez LLM: gradúa la DECISIÓN de un sistema contra la rúbrica de spec.md.
// No re-resuelve el caso ni ve la etiqueta esperada. Sin clave no corre.
// Uso: GEMINI_API_KEY=... node judge.mjs [--system jev|gemini] [--sample 30]
import fs from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KEY = (process.env.GEMINI_API_KEY || process.env.GEMINI_EVAL_KEY || '').trim();
const MODEL = process.env.GEMINI_JUDGE_MODEL || 'gemini-3.1-flash-lite';
if (!KEY) {
  console.error('Falta GEMINI_API_KEY. Sin clave el juez no corre.');
  process.exit(2);
}

const SYSTEM = arg('system', 'jev');
const SAMPLE = Number(arg('sample', 30));
const DECISIONS = ['APROBAR_DIRECTO', 'SOLICITAR_2FA', 'BLOQUEO_PREVENTIVO'];

// el juez lee lo que produjo el sistema, no el set
const scored = JSON.parse(fs.readFileSync('scored.json', 'utf8')).cases;
const pool = scored.filter((c) => c[SYSTEM] && c[SYSTEM] !== '');
if (!pool.length) {
  console.error(`No hay decisiones de "${SYSTEM}" en scored.json.`);
  process.exit(1);
}

// muestra estratificada por clase, con offset para no ser siempre un prefijo
const classes = [...new Set(pool.map((c) => c.class))];
const per = Math.ceil(SAMPLE / classes.length);
let cases = [];
for (const cls of classes) {
  const g = pool.filter((c) => c.class === cls);
  const step = Math.max(1, Math.floor(g.length / per));
  cases = cases.concat(g.filter((_, i) => i % step === 0).slice(0, per));
}
cases = cases.slice(0, SAMPLE);

const RUBRIC = `Eres un juez que aplica una rúbrica fija. Recibes una transacción y la decisión que tomó un sistema.
Tu tarea NO es resolver el caso: es decir si la decisión respeta la rúbrica.
Rúbrica, se aplica en orden y gana la primera que se cumple:
1. Bloquear si hay dos o más señales altas juntas: dispositivo nuevo, CVV fallidos, geopatrón imposible, ráfaga anómala, comercio de riesgo.
2. Pedir 2FA si hay una señal alta o dos medias y ninguna conclusiva.
3. Aprobar si no hay señales, o si la anomalía está explicada por el contexto (viaje declarado, compra planificada, dispositivo registrado).
Responde SOLO con JSON: {"verdict":"correcto"|"incorrecto","score":0.0,"reason":"..."}
score es tu confianza, de 0 a 1. No uses el nombre ni el id del caso: evalúa solo los hechos.`;

function caseText(c) {
  return `Comercio: ${c.merchant}
Importe: ${c.amount}
Dispositivo: ${c.device}
Ubicación: ${c.location}
Velocidad (transacciones última hora): ${c.velocityLastHour}
Contexto: ${c.context}
DECISIÓN DEL SISTEMA: ${c.decision}`;
}

// el scored.json no guarda la transacción completa: se toma del set por id
const set = JSON.parse(fs.readFileSync('golden_set.json', 'utf8')).cases;
const byId = new Map(set.map((c) => [c.id, c]));

function payload(c) {
  const origin = byId.get(c.id);
  const t = origin?.transaction ?? {};
  return {
    merchant: t.merchant ?? '', amount: t.amountFormatted ?? t.amount ?? '',
    device: t.device ?? '', location: t.location ?? '',
    velocityLastHour: t.velocityLastHour ?? '', context: t.context ?? '',
    decision: c[SYSTEM],
  };
}

async function judge(c) {
  const body = {
    contents: [{ parts: [{ text: `${RUBRIC}\n\nCASO\n${caseText(payload(c))}` }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const out = JSON.parse(text);
      const verdict = out.verdict === 'correcto' ? 'correcto' : out.verdict === 'incorrecto' ? 'incorrecto' : null;
      return { verdict, score: Number(out.score) || null, reason: String(out.reason ?? '') };
    } catch (e) {
      if (attempt === 2) return { verdict: null, score: null, reason: `ERROR: ${e.message}` };
      await sleep(2000 * (attempt + 1));
    }
  }
}

const rows = [];
const CONCURRENCY = 1;
const DELAY = 4000;
for (let i = 0; i < cases.length; i += CONCURRENCY) {
  const batch = cases.slice(i, i + CONCURRENCY);
  const verdicts = await Promise.all(batch.map((c) => judge(c)));
  batch.forEach((c, k) => {
    const v = verdicts[k];
    // la etiqueta y la corrección real quedan del lado del eval, no del juez
    rows.push({
      id: c.id, class: c.class, system: SYSTEM,
      decision: c[SYSTEM], expected: c.expected,
      decision_ok: c[SYSTEM] === c.expected,
      ...v,
    });
  });
  process.stdout.write(`\r${Math.min(i + CONCURRENCY, cases.length)}/${cases.length}      `);
}
process.stdout.write('\n');

const answered = rows.filter((r) => r.verdict);
if (answered.length === 0) {
  console.error(`Ninguna llamada respondió, no se escribe judged.json. Primer error: ${rows[0]?.reason ?? 'desconocido'}`);
  process.exit(1);
}

const judged = {
  version: 2, model: MODEL, system: SYSTEM, rubric: 'spec.md',
  generated_at: new Date().toISOString(), cases: rows,
};
fs.writeFileSync('judged.json', JSON.stringify(judged, null, 2) + '\n', 'utf8');

const agree = answered.filter((r) => (r.verdict === 'correcto') === r.decision_ok).length;
console.log(`judged.json: ${rows.length} casos · el juez coincide con la etiqueta en ${agree}/${answered.length}`);
if (answered.length < rows.length) console.log(`  ${rows.length - answered.length} caso(s) sin respuesta del juez`);
