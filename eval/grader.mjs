// Puntúa results.csv contra golden_set.json y escribe scored.json.
// No llama a ningún modelo: la etiqueta esperada es la vara.
import fs from 'node:fs';

function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const set = JSON.parse(fs.readFileSync('golden_set.json', 'utf8'));
const byId = new Map(set.cases.map((c) => [c.id, c]));
const superseded = new Set(set.cases.filter((c) => c.superseded_by).map((c) => c.id));
const rows = parseCSV(fs.readFileSync('results.csv', 'utf8'));
const head = rows.shift();
const ix = Object.fromEntries(head.map((h, i) => [h, i]));

const unknown = [];
const skipped = [];
const scored = rows.filter((r) => r.length > 1 && r[ix.id]).filter((r) => {
  if (superseded.has(r[ix.id])) { skipped.push(r[ix.id]); return false; }
  return true;
}).map((r) => {
  const id = r[ix.id];
  const c = byId.get(id);
  if (!c) unknown.push(id);
  const jev = r[ix.jev] || null;
  const gem = r[ix.gemini] || null;
  const src = r[ix.gem_fuente] || '';
  return {
    id,
    class: c?.class ?? null,
    expected: c?.expected ?? null,
    jev,
    gem,
    gem_source: src,
    ok_jev: c ? jev === c.expected : null,
    ok_gem: !c || src === 'gemini-contingencia' ? null : gem === c.expected,
    jev_ms: Number(r[ix.jev_ms]) || null,
    gem_ms: Number(r[ix.gem_ms]) || null,
    gem_tokens: r[ix.gem_tokens] || '',
    jev_fraude: r[ix.jev_fraude] ? Number(r[ix.jev_fraude]) : null,
  };
});

fs.writeFileSync('scored.json', JSON.stringify({ version: 1, cases: scored }, null, 2) + '\n', 'utf8');

const hits = (sys) => scored.filter((s) => s[`ok_${sys}`] === true).length;
const base = (sys) => scored.filter((s) => s[`ok_${sys}`] !== null).length;
console.log(`scored.json: ${scored.length} casos`);
console.log(`  jev   ${hits('jev')}/${base('jev')}`);
console.log(`  gemini ${hits('gem')}/${base('gem')}`);
if (skipped.length) console.log(`  ${skipped.length} fila(s) omitidas por superseded`);
if (unknown.length) {
  console.error(`AVISO: ${unknown.length} filas con id fuera del golden set: ${unknown.slice(0, 3).join(', ')}`);
  process.exitCode = 1;
}
