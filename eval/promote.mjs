// Cierra el ciclo: adjudica un fallo y lo agrega al golden set con versión nueva.
// Dos modos:
//   node promote.mjs --id EVAL-gray-004 --decision SOLICITAR_2FA [--note "..."]
//   node promote.mjs --from-json caso.json     (caso nuevo de producción con su transaction)
// El caso nuevo se ejecuta en la próxima corrida porque el runner lee golden_set.json.
import fs from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};

const DECISIONS = ['APROBAR_DIRECTO', 'SOLICITAR_2FA', 'BLOQUEO_PREVENTIVO'];
const id = arg('id');
const decision = arg('decision');
const fromJson = arg('from-json');
const note = arg('note', '');

if (!fromJson && (!id || !decision)) {
  console.error('Uso: node promote.mjs --id <caso> --decision <...> [--note "..."]');
  console.error('     node promote.mjs --from-json <archivo.json>');
  process.exit(2);
}
if (decision && !DECISIONS.includes(decision)) {
  console.error(`Decisión inválida: ${decision}. Usa una de: ${DECISIONS.join(', ')}`);
  process.exit(2);
}

const set = JSON.parse(fs.readFileSync('golden_set.json', 'utf8'));
const nextVersion = (set.version || 1) + 1;
const taken = new Set(set.cases.map((c) => c.id));
let promoted;

if (fromJson) {
  // caso nuevo: no está en el set, viene de producción con su transacción observada
  const src = JSON.parse(fs.readFileSync(fromJson, 'utf8'));
  if (!src.id || !src.class || !src.expected || !src.transaction) {
    console.error('El JSON necesita id, class, expected y transaction.');
    process.exit(2);
  }
  if (!DECISIONS.includes(src.expected)) {
    console.error(`expected inválido: ${src.expected}`);
    process.exit(2);
  }
  if (taken.has(src.id)) {
    console.error(`El id ${src.id} ya existe en el set.`);
    process.exit(1);
  }
  promoted = {
    id: src.id, class: src.class, expected: src.expected, transaction: src.transaction,
    source: 'produccion', promoted_at: new Date().toISOString().slice(0, 10),
    note: src.note || note || undefined,
  };
} else {
  // re-adjudicación: el caso ya existe y se corrige su etiqueta
  const origin = set.cases.find((c) => c.id === id);
  if (!origin) {
    console.error(`El caso ${id} no está en el set. Para un fallo nuevo usa --from-json.`);
    process.exit(1);
  }
  const newId = `${id}-v${nextVersion}`;
  promoted = {
    ...origin, id: newId, expected: decision, source: 'produccion',
    promoted_at: new Date().toISOString().slice(0, 10),
    note: note || undefined, supersedes: id,
  };
  origin.superseded_by = newId;
}

set.version = nextVersion;
set.cases.push(promoted);
fs.writeFileSync('golden_set.json', JSON.stringify(set, null, 2) + '\n', 'utf8');

console.log(`golden set v${nextVersion}: ${set.cases.length} casos`);
console.log(`  + ${promoted.id} (${promoted.class}) -> ${promoted.expected}`);
if (promoted.supersedes) console.log(`  ${promoted.supersedes} queda superseded; el grader lo omite.`);
console.log('  Regenera el baseline: esta versión no es comparable con la anterior.');
