// Lists every case whose output contains a doubled word, in both snapshots.
//   node tools/doubled.mjs tools/baseline.json tools/engine2.json

import { readFileSync } from 'node:fs';

const [, , aPath, bPath] = process.argv;
const LEGIT = /^(Ho ho|Yo ho ho|Yes, yes|Ha ha)/i;

const a = JSON.parse(readFileSync(aPath, 'utf8'));
const b = JSON.parse(readFileSync(bPath, 'utf8'));

for (const file of Object.keys(a)) {
  const rows = [];
  for (const key of Object.keys(a[file].results)) {
    const before = a[file].results[key];
    const after = b[file].results[key];
    const mb = before.match(/\b([A-Za-z']+) \1\b/i);
    const ma = after.match(/\b([A-Za-z']+) \1\b/i);
    if (!mb && !ma) continue;
    rows.push({ key, mb, ma, before, after });
  }
  if (!rows.length) continue;
  console.log(`\n${'='.repeat(76)}\n${file}   ${rows.length} case(s)\n${'='.repeat(76)}`);
  for (const r of rows) {
    const status = r.mb && !r.ma ? 'FIXED' : !r.mb && r.ma ? 'NEW REGRESSION' : 'unchanged';
    console.log(`\n  [${status}]  input: ${JSON.stringify(r.key.split('::')[1])}`);
    console.log(`    before: ${JSON.stringify(r.before)}`);
    console.log(`    after : ${JSON.stringify(r.after)}`);
    if (LEGIT.test(r.after)) console.log(`    (note: opening phrase may be legitimate)`);
  }
}
