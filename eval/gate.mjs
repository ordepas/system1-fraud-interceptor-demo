// Puerta de calidad: compara metrics.json del candidato contra el baseline.
// Uso: node gate.mjs [--system jev] [--baseline baseline.json] [--min-accuracy 85] [--max-p95 800] [--max-drop 2]
// Sale con código 1 si alguna regla falla, para poder colgarlo de CI.
import fs from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};

const system = arg('system', 'jev');
const baselinePath = arg('baseline', 'baseline.json');
const minAccuracy = Number(arg('min-accuracy', 85));
const maxP95 = Number(arg('max-p95', 800));
const maxDrop = Number(arg('max-drop', 2));

const cand = JSON.parse(fs.readFileSync('metrics.json', 'utf8'));
const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

const c = cand.systems?.[system];
const b = base.systems?.[system];
if (!c || !b) {
  console.error(`No hay métricas para el sistema "${system}" en uno de los archivos.`);
  process.exit(1);
}

const rules = [];
const add = (name, ok, detail) => rules.push({ name, ok, detail });

add('accuracy mínima', c.accuracy >= minAccuracy, `${c.accuracy}% (mínimo ${minAccuracy}%)`);
add('p95 de latencia', c.p95_ms <= maxP95, `${c.p95_ms} ms (máximo ${maxP95} ms)`);
add('caída contra baseline', c.accuracy >= b.accuracy - maxDrop,
  `${c.accuracy}% vs ${b.accuracy}% (máximo ${maxDrop} puntos)`);

console.log(`GATE · ${system} · candidato ${cand.generated_at ?? 'sin fecha'} vs baseline`);
console.log('─'.repeat(58));
for (const r of rules) console.log(`  ${r.ok ? 'PASA' : 'FALLA'}  ${r.name.padEnd(22)} ${r.detail}`);
const failed = rules.filter((r) => !r.ok).length;
console.log('─'.repeat(58));
console.log(failed ? `GATE CERRADO · ${failed} regla(s) fallan` : 'GATE ABIERTO');
process.exit(failed ? 1 : 0);
