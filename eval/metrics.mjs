// Agrega scored.json (y judged.json si existe) en metrics.json.
// Acierto por clase, matriz de confusión, p50/p95, dispersión y acuerdo del juez.
import fs from 'node:fs';

const scoredFile = JSON.parse(fs.readFileSync('scored.json', 'utf8'));
const scored = scoredFile.cases;
const RUN_ID = scoredFile.run_id ?? null;
const setVersion = fs.existsSync('golden_set.json')
  ? JSON.parse(fs.readFileSync('golden_set.json', 'utf8')).version
  : null;

const pct = (n, d) => (d ? Math.round((10000 * n) / d) / 100 : null);
const sorted = (a) => [...a].sort((x, y) => x - y);
const p = (arr, q) => (arr.length ? sorted(arr)[Math.floor(q * (arr.length - 1))] : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};

function kappa(xs, ys) {
  const n = xs.length;
  if (!n) return null;
  const po = xs.filter((x, i) => x === ys[i]).length / n;
  const cats = [...new Set([...xs, ...ys])];
  const pe = cats.reduce((s, c) => {
    const px = xs.filter((x) => x === c).length / n;
    const py = ys.filter((y) => y === c).length / n;
    return s + px * py;
  }, 0);
  return pe === 1 ? 0 : Math.round(((po - pe) / (1 - pe)) * 1000) / 1000;
}

const classes = [...new Set(scored.map((s) => s.class).filter(Boolean))];
const systems = {};

for (const [name, okKey, msKey, decKey] of [
  ['jev', 'ok_jev', 'jev_ms', 'jev'],
  ['gemini', 'ok_gem', 'gem_ms', 'gem'],
]) {
  const base = scored.filter((s) => s[okKey] !== null);
  const lat = base.map((s) => s[msKey]).filter((v) => typeof v === 'number');
  const byClass = {};
  for (const c of classes) {
    const g = base.filter((s) => s.class === c);
    byClass[c] = { base: g.length, hits: g.filter((s) => s[okKey]).length, accuracy: pct(g.filter((s) => s[okKey]).length, g.length) };
  }
  // matriz de confusión: fila = esperado, columna = decidido
  const confusion = {};
  for (const c of classes) confusion[c] = {};
  for (const s of base) {
    const exp = s.expected ?? 'desconocido';
    const dec = s[decKey] ?? 'sin_respuesta';
    confusion[exp] = confusion[exp] ?? {};
    confusion[exp][dec] = (confusion[exp][dec] ?? 0) + 1;
  }
  systems[name] = {
    base: base.length,
    hits: base.filter((s) => s[okKey]).length,
    accuracy: pct(base.filter((s) => s[okKey]).length, base.length),
    by_class: byClass,
    confusion,
    p50_ms: p(lat, 0.5),
    p95_ms: p(lat, 0.95),
    tokens_total: name === 'gemini'
      ? base.reduce((t, s) => {
        const [i, o] = String(s.gem_tokens).split('/').map(Number);
        return t + (i || 0) + (o || 0);
      }, 0)
      : null,
  };
}

// juez: coincide con la etiqueta al juzgar la decisión del sistema
if (fs.existsSync('judged.json')) {
  const j = JSON.parse(fs.readFileSync('judged.json', 'utf8'));
  if ((j.version ?? 1) < 2) {
    console.warn('judged.json es del formato viejo (el juez no graduaba al sistema). Se ignora: corre judge.mjs otra vez.');
  } else {
  const answered = j.cases.filter((x) => x.verdict);
  const agree = answered.filter((x) => (x.verdict === 'correcto') === x.decision_ok);
  systems.judge = {
    system: j.system ?? 'jev',
    base: answered.length,
    hits: agree.length,
    accuracy: pct(agree.length, answered.length),
    kappa: answered.length > 1
      ? kappa(
        answered.map((x) => (x.verdict === 'correcto' ? 1 : 0)),
        answered.map((x) => (x.decision_ok ? 1 : 0)),
      )
      : null,
    model: j.model,
    cases_total: j.cases.length,
  };
  }
}

const spread = {};
for (const c of classes) {
  const v = scored.filter((s) => s.class === c && s.jev_fraude !== null).map((s) => s.jev_fraude);
  spread[c] = { n: v.length, mean: v.length ? Math.round(mean(v) * 10) / 10 : null, sd: v.length ? Math.round(sd(v) * 10) / 10 : null };
}

const out = {
  version: 2,
  set_version: setVersion,
  run_id: RUN_ID,
  generated_at: new Date().toISOString(),
  cases: scored.length,
  systems,
  spread,
};
fs.writeFileSync('metrics.json', JSON.stringify(out, null, 2) + '\n', 'utf8');

for (const [name, s] of Object.entries(systems)) {
  const extra = s.kappa !== undefined ? `  kappa ${s.kappa}` : '';
  console.log(`${name.padEnd(7)} accuracy ${s.accuracy}% (${s.hits}/${s.base})${extra}`);
}
console.log('spread (sd de probabilidad de fraude):', classes.map((c) => `${c} ${spread[c].sd}`).join(' · '));
console.log(`metrics.json escrito (golden set v${setVersion})`);
