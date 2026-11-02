// Agrega scored.json (y judged.json si existe) en metrics.json.
// Acierto por clase, p50/p95, dispersión y acuerdo del juez.
import fs from 'node:fs';

const scored = JSON.parse(fs.readFileSync('scored.json', 'utf8')).cases;
const pct = (n, d) => (d ? Math.round((10000 * n) / d) / 100 : null);
const sorted = (a) => [...a].sort((x, y) => x - y);
const p = (arr, q) => (arr.length ? sorted(arr)[Math.floor(q * (arr.length - 1))] : null);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sd = (a) => {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
};

// kappa de Cohen: acuerdo que no se explica por azar
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

for (const [name, okKey, msKey] of [['jev', 'ok_jev', 'jev_ms'], ['gemini', 'ok_gem', 'gem_ms']]) {
  const base = scored.filter((s) => s[okKey] !== null);
  const lat = base.map((s) => s[msKey]).filter((v) => typeof v === 'number');
  const byClass = {};
  for (const c of classes) {
    const g = base.filter((s) => s.class === c);
    byClass[c] = { base: g.length, hits: g.filter((s) => s[okKey]).length, accuracy: pct(g.filter((s) => s[okKey]).length, g.length) };
  }
  systems[name] = {
    base: base.length,
    hits: base.filter((s) => s[okKey]).length,
    accuracy: pct(base.filter((s) => s[okKey]).length, base.length),
    by_class: byClass,
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

// juez LLM: acuerdo con la etiqueta y kappa
if (fs.existsSync('judged.json')) {
  const j = JSON.parse(fs.readFileSync('judged.json', 'utf8'));
  const answered = j.cases.filter((x) => x.decision);
  const byClass = {};
  for (const c of classes) {
    const g = answered.filter((x) => x.class === c);
    byClass[c] = { base: g.length, hits: g.filter((x) => x.ok).length, accuracy: pct(g.filter((x) => x.ok).length, g.length) };
  }
  systems.judge = {
    base: answered.length,
    hits: answered.filter((x) => x.ok).length,
    accuracy: pct(answered.filter((x) => x.ok).length, answered.length),
    by_class: byClass,
    kappa: new Set(answered.map((x) => x.expected)).size > 1
      ? kappa(answered.map((x) => x.decision), answered.map((x) => x.expected))
      : null,
    model: j.model,
    cases_total: j.cases.length,
  };
}

const spread = {};
for (const c of classes) {
  const v = scored.filter((s) => s.class === c && s.jev_fraude !== null).map((s) => s.jev_fraude);
  spread[c] = { n: v.length, mean: v.length ? Math.round(mean(v) * 10) / 10 : null, sd: v.length ? Math.round(sd(v) * 10) / 10 : null };
}

const out = { version: 1, generated_at: new Date().toISOString(), cases: scored.length, systems, spread };
fs.writeFileSync('metrics.json', JSON.stringify(out, null, 2) + '\n', 'utf8');

for (const [name, s] of Object.entries(systems)) {
  const extra = s.kappa !== undefined ? `  kappa ${s.kappa}` : '';
  console.log(`${name.padEnd(7)} accuracy ${s.accuracy}% (${s.hits}/${s.base})${extra}`);
}
console.log('spread (sd de probabilidad de fraude):', classes.map((c) => `${c} ${spread[c].sd}`).join(' · '));
console.log('metrics.json escrito');
