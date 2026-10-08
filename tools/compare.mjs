// Compares two snapshots and reports every changed case.
//   node tools/snapshot.mjs tools/after.json
//   node tools/compare.mjs tools/baseline.json tools/after.json [--show N]

import { readFileSync } from 'node:fs';

const [, , aPath, bPath] = process.argv;
if (!aPath || !bPath) {
  console.error('usage: node tools/compare.mjs <before.json> <after.json> [--show N]');
  process.exit(1);
}
const showArg = process.argv.indexOf('--show');
const SHOW = showArg > -1 ? Number(process.argv[showArg + 1]) : 12;

const before = JSON.parse(readFileSync(aPath, 'utf8'));
const after = JSON.parse(readFileSync(bPath, 'utf8'));

let totalChanged = 0;
let totalSame = 0;
const perPage = [];

for (const file of Object.keys(before)) {
  if (!after[file]) {
    perPage.push({ file, note: 'MISSING IN AFTER' });
    continue;
  }
  let changed = 0;
  let same = 0;
  const samples = [];

  for (const key of Object.keys(before[file].results)) {
    const b = before[file].results[key];
    const a = after[file].results[key] ?? '<MISSING>';
    if (a === b) { same++; continue; }
    changed++;
    if (samples.length < SHOW) samples.push({ key, before: b, after: a });
  }

  totalChanged += changed;
  totalSame += same;
  const pct = before[file].results && Object.keys(before[file].results).length
    ? ((changed / Object.keys(before[file].results).length) * 100).toFixed(1)
    : '0.0';
  perPage.push({ file, changed, same, pct, samples });
}

console.log(`\n${'page'.padEnd(20)} ${'changed'.padStart(8)} ${'same'.padStart(7)}  ${'%'.padStart(6)}`);
console.log('-'.repeat(46));
for (const p of perPage) {
  if (p.note) { console.log(`${p.file.padEnd(20)}  ${p.note}`); continue; }
  console.log(`${p.file.padEnd(20)} ${String(p.changed).padStart(8)} ${String(p.same).padStart(7)}  ${String(p.pct).padStart(6)}%`);
}
console.log('-'.repeat(46));
console.log(`${'TOTAL'.padEnd(20)} ${String(totalChanged).padStart(8)} ${String(totalSame).padStart(7)}`);

// Defect census: patterns that indicate a broken transformation.
const DEFECTS = [
  [/\b([A-Za-z']+) \1\b/i, 'doubled word'],
  [/[a-z],[a-z]/, 'comma fused to word'],
  [/\bto't\b/, "leaked 't fragment"],
  [/\b(\w+) \1\b/gi, 'any repeat'],
];

function census(snap) {
  const out = {};
  let total = 0;
  for (const file of Object.keys(snap)) {
    for (const [re, label] of DEFECTS) {
      let n = 0;
      for (const key of Object.keys(snap[file].results)) {
        if (re.test(snap[file].results[key])) n++;
      }
      if (n) {
        out[`${file} :: ${label}`] = n;
        total += n;
      }
    }
  }
  return { out, total };
}

const cb = census(before);
const ca = census(after);

console.log(`\n${'='.repeat(72)}\nDEFECT CENSUS  (cases containing the pattern)\n${'='.repeat(72)}`);
console.log(`${'page / pattern'.padEnd(46)} ${'before'.padStart(7)} ${'after'.padStart(7)}  ${'delta'.padStart(6)}`);
console.log('-'.repeat(72));
const keys = [...new Set([...Object.keys(cb.out), ...Object.keys(ca.out)])];
for (const k of keys) {
  const b = cb.out[k] || 0;
  const a = ca.out[k] || 0;
  const d = a - b;
  const mark = d < 0 ? `-${-d}` : d > 0 ? `+${d} WORSE` : '=';
  console.log(`${k.padEnd(46)} ${String(b).padStart(7)} ${String(a).padStart(7)}  ${String(mark).padStart(6)}`);
}
console.log('-'.repeat(72));
console.log(`${'TOTAL'.padEnd(46)} ${String(cb.total).padStart(7)} ${String(ca.total).padStart(7)}  ${String(ca.total - cb.total).padStart(6)}`);

if (showArg > -1) {
  for (const p of perPage) {
    if (!p.samples?.length) continue;
    console.log(`\n${'='.repeat(78)}\n${p.file}\n${'='.repeat(78)}`);
    for (const s of p.samples) {
      console.log(`\n--- input [${s.key}]`);
      console.log(`  BEFORE: ${JSON.stringify(s.before)}`);
      console.log(`  AFTER : ${JSON.stringify(s.after)}`);
    }
  }
}

process.exitCode = 0;
