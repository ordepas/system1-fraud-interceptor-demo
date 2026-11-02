// Agrega scored.json en metrics.json: acierto por clase, p50/p95 y dispersión.
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

const spread = {};
for (const c of classes) {
  const v = scored.filter((s) => s.class === c && s.jev_fraude !== null).map((s) => s.jev_fraude);
  spread[c] = { n: v.length, mean: v.length ? Math.round(mean(v) * 10) / 10 : null, sd: v.length ? Math.round(sd(v) * 10) / 10 : null };
}

const out = { version: 1, generated_at: new Date().toISOString(), cases: scored.length, systems, spread };
fs.writeFileSync('metrics.json', JSON.stringify(out, null, 2) + '\n', 'utf8');

for (const [name, s] of Object.entries(systems)) {
  console.log(`${name.padEnd(7)} accuracy ${s.accuracy}% (${s.hits}/${s.base})  p50 ${s.p50_ms} ms  p95 ${s.p95_ms} ms`);
}
console.log('spread (sd de probabilidad de fraude):', classes.map((c) => `${c} ${spread[c].sd}`).join(' · '));
console.log('metrics.json escrito');
