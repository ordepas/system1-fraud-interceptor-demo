// Puerta de calidad: compara metrics.json del candidato contra un baseline congelado.
// Uso: node gate.mjs [--system jev] [--baseline-system jev] [--baseline baseline.json]
//      [--min-accuracy 85] [--max-p95 800] [--max-drop 2] [--min-judge 70] [--min-kappa 0.4]
// Sale con código 1 si alguna regla falla. Falla cerrado: sin datos, no pasa.
import fs from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};

const system = arg('system', 'jev');
const baselineSystem = arg('baseline-system', system);
const baselinePath = arg('baseline', 'baseline.json');
const minAccuracy = Number(arg('min-accuracy', 85));
const maxP95 = Number(arg('max-p95', 800));
const maxDrop = Number(arg('max-drop', 2));
const minJudge = Number(arg('min-judge', 70));
const minKappa = Number(arg('min-kappa', 0.4));
const GRAY = 'gris';

const cand = JSON.parse(fs.readFileSync('metrics.json', 'utf8'));
const base = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

const c = cand.systems?.[system];
const b = base.systems?.[baselineSystem];
if (!c || !b) {
  console.error(`No hay métricas para "${system}" (candidato) o "${baselineSystem}" (baseline).`);
  process.exit(1);
}

const rules = [];
const add = (name, ok, detail) => rules.push({ name, ok: !!ok, detail });

// 1. mismo dataset
add('versión del dataset', cand.set_version != null && cand.set_version === base.set_version,
  `candidato v${cand.set_version ?? '?'} vs baseline v${base.set_version ?? '?'}`);

// 2. no es la misma corrida
add('corrida independiente', cand.run_id != null && cand.run_id !== base.run_id,
  cand.run_id == null ? 'sin run_id' : cand.run_id === base.run_id ? 'candidato y baseline son la misma corrida' : 'ok');

// 3. cobertura
const expectedCases = fs.existsSync('golden_set.json')
  ? JSON.parse(fs.readFileSync('golden_set.json', 'utf8')).cases.length
  : null;
add('cobertura completa', expectedCases != null && cand.cases >= expectedCases,
  `${cand.cases} de ${expectedCases ?? '?'} casos`);

// 4. accuracy y latencia, sin tolerar nulls
add('accuracy mínima', c.accuracy != null && c.accuracy >= minAccuracy,
  c.accuracy == null ? 'sin datos' : `${c.accuracy}% (mínimo ${minAccuracy}%)`);
add('p95 de latencia', c.p95_ms != null && c.p95_ms <= maxP95,
  c.p95_ms == null ? 'sin datos de latencia' : `${c.p95_ms} ms (máximo ${maxP95} ms)`);

// 5. no empeorar, global y en la zona gris (lo único que discrimina)
add('caída contra baseline', c.accuracy >= b.accuracy - maxDrop,
  `${c.accuracy}% vs ${b.accuracy}% (máximo ${maxDrop} puntos)`);
const cg = c.by_class?.[GRAY]?.accuracy;
const bg = b.by_class?.[GRAY]?.accuracy;
add(`caída en ${GRAY}`, cg != null && bg != null && cg >= bg - maxDrop,
  `${cg ?? '?'}% vs ${bg ?? '?'}% (máximo ${maxDrop} puntos)`);

// 6. juez, si corrió
if (cand.systems?.judge) {
  const j = cand.systems.judge;
  add('acuerdo del juez', j.accuracy != null && j.accuracy >= minJudge,
    j.accuracy == null ? 'sin datos' : `${j.accuracy}% (mínimo ${minJudge}%)`);
  add('kappa del juez', j.kappa != null && j.kappa >= minKappa,
    j.kappa == null ? 'sin datos' : `${j.kappa} (mínimo ${minKappa})`);
}

console.log(`GATE · ${system} vs baseline ${baselineSystem} · ${cand.generated_at ?? 'sin fecha'}`);
console.log('─'.repeat(62));
for (const r of rules) console.log(`  ${r.ok ? 'PASA ' : 'FALLA'}  ${r.name.padEnd(24)} ${r.detail}`);
const failed = rules.filter((r) => !r.ok).length;
console.log('─'.repeat(62));
console.log(failed ? `GATE CERRADO · ${failed} regla(s) fallan` : 'GATE ABIERTO');
process.exit(failed ? 1 : 0);
