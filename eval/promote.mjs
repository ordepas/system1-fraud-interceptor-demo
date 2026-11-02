// Cierra el ciclo: adjudica un fallo real y lo agrega al golden set con versión nueva.
// Uso: node promote.mjs --id EVAL-gray-004 --decision SOLICITAR_2FA --note "revisado el 2026-11-02"
// La etiqueta nunca se cambia en silencio: si el caso ya existía, entra como id-vN.
import fs from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};

const DECISIONS = ['APROBAR_DIRECTO', 'SOLICITAR_2FA', 'BLOQUEO_PREVENTIVO'];
const id = arg('id');
const decision = arg('decision');
const note = arg('note', '');

if (!id || !decision) {
  console.error('Uso: node promote.mjs --id <caso> --decision <APROBAR_DIRECTO|SOLICITAR_2FA|BLOQUEO_PREVENTIVO> [--note "..."]');
  process.exit(2);
}
if (!DECISIONS.includes(decision)) {
  console.error(`Decisión inválida: ${decision}. Usa una de: ${DECISIONS.join(', ')}`);
  process.exit(2);
}

const set = JSON.parse(fs.readFileSync('golden_set.json', 'utf8'));
const origin = set.cases.find((c) => c.id === id);
if (!origin) {
  console.error(`El caso ${id} no está en el golden set. Solo se promueven casos adjudicados que ya existen.`);
  process.exit(1);
}

const nextVersion = (set.version || 1) + 1;
const taken = new Set(set.cases.map((c) => c.id));
const newId = taken.has(id) && origin.source !== 'produccion' ? `${id}-v${nextVersion}` : id;

if (taken.has(newId)) {
  console.error(`El id ${newId} ya existe. Revisa el caso antes de promoverlo otra vez.`);
  process.exit(1);
}

const promoted = {
  ...origin,
  id: newId,
  expected: decision,
  source: 'produccion',
  promoted_at: new Date().toISOString().slice(0, 10),
  note: note || undefined,
  supersedes: newId === id ? origin.id : id,
};

set.version = nextVersion;
set.cases.push(promoted);
fs.writeFileSync('golden_set.json', JSON.stringify(set, null, 2) + '\n', 'utf8');

const changed = origin.expected !== decision;
console.log(`golden set v${nextVersion}: ${set.cases.length} casos`);
console.log(`  + ${newId}  (${origin.class})  ${origin.expected} -> ${decision}${changed ? '  [etiqueta corregida]' : '  [sin cambio de etiqueta]'}`);
if (changed) console.log('  La versión anterior queda en supersedes; las corridas viejas no son comparables.');
