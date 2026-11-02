// Juez LLM: aplica la rúbrica de spec.md y emite una decisión por caso.
// Uso: GEMINI_API_KEY=... node judge.mjs [--only gray|all] [--sample N]
// Sin clave no corre: no inventa resultados.
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

const set = JSON.parse(fs.readFileSync('golden_set.json', 'utf8')).cases;
const only = arg('only', 'all');
let cases = only === 'all' ? set : set.filter((c) => c.class === 'gris');
const sample = Number(arg('sample', 30));
if (sample > 0) {
  if (only === 'all') {
    // estratificado: mismas porciones de cada clase, si no la muestra cae en los casos fáciles
    const classes = ['legítimo', 'fraude', 'gris'];
    const per = Math.ceil(sample / classes.length);
    cases = classes.flatMap((c) => cases.filter((x) => x.class === c).slice(0, per)).slice(0, sample);
  } else {
    cases = cases.slice(0, sample);
  }
}

const RUBRIC = `Eres un juez que aplica una rúbrica fija, no tu criterio. Decide entre tres salidas:
APROBAR_DIRECTO, SOLICITAR_2FA o BLOQUEO_PREVENTIVO.
Aplica en orden y devuelve la primera que se cumple:
1. Bloquear si hay dos o más señales altas juntas: dispositivo nuevo, CVV fallidos, geopatrón imposible, ráfaga anómala, comercio de riesgo.
2. Pedir 2FA si hay una señal alta o dos medias y ninguna conclusiva.
3. Aprobar si no hay señales, o si la anomalía está explicada por el contexto (viaje declarado, compra planificada, dispositivo registrado).
Responde SOLO con JSON: {"decision":"...","score":0.0,"reason":"..."}
score es tu confianza en la decisión, de 0 a 1.`;

function caseText(c) {
  const t = c.transaction;
  return `Comercio: ${t.merchant}
Importe: ${t.amountFormatted}
Dispositivo: ${t.device}
Ubicación: ${t.location}
Velocidad (transacciones última hora): ${t.velocityLastHour}
Anomalía declarada por el sistema: ${t.isAnomaly}
Contexto: ${t.context}`;
}

async function judge(c) {
  const body = {
    contents: [{ parts: [{ text: `${RUBRIC}\n\nCASO ${c.id}\n${caseText(c)}` }] }],
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
      return { decision: out.decision ?? null, score: Number(out.score) || null, reason: String(out.reason ?? '') };
    } catch (e) {
      if (attempt === 2) return { decision: null, score: null, reason: `ERROR: ${e.message}` };
      await sleep(2000 * (attempt + 1));
    }
  }
}

const rows = [];
const CONCURRENCY = 2;
for (let i = 0; i < cases.length; i += CONCURRENCY) {
  const batch = cases.slice(i, i + CONCURRENCY);
  const verdicts = await Promise.all(batch.map((c) => judge(c)));
  batch.forEach((c, k) => {
    const v = verdicts[k];
    rows.push({ id: c.id, class: c.class, expected: c.expected, ...v, ok: v.decision === c.expected });
  });
  process.stdout.write(`\r${Math.min(i + CONCURRENCY, cases.length)}/${cases.length}      `);
}
process.stdout.write('\n');

const judged = {
  version: 1, model: MODEL, generated_at: new Date().toISOString(),
  rubric: 'spec.md', cases: rows,
};
const hits = rows.filter((r) => r.ok).length;
const answered = rows.filter((r) => r.decision).length;
if (answered === 0) {
  console.error(`Ninguna llamada respondió, no se escribe judged.json. Primer error: ${rows[0]?.reason ?? 'desconocido'}`);
  process.exit(1);
}
fs.writeFileSync('judged.json', JSON.stringify(judged, null, 2) + '\n', 'utf8');
console.log(`judged.json: ${rows.length} casos · juez ${hits}/${answered} de acuerdo con la etiqueta`);
if (answered < rows.length) console.log(`  ${rows.length - answered} caso(s) sin respuesta del juez`);
