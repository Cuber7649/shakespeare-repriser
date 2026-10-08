// Inspects transform output for cascade artifacts and shows context.
//   node tools/inspect.mjs                    -> artifact report from a snapshot
//   node tools/inspect.mjs "some input text"  -> run one input through every page

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  ['shakespeare.html', 'shakespearify'],
  ['pirate.html', 'pirateify'],
  ['victorian.html', 'victorianify'],
  ['chaucer.html', 'chaucerify'],
  ['yoda.html', 'yodaify'],
  ['norse.html', 'norseify'],
];

const input = process.argv.slice(2).join(' ');
if (input) {
  for (const [file, entry] of PAGES) {
    const page = loadPage(join(ROOT, file), entry);
    console.log(`\n${'='.repeat(70)}\n${file}   <-   ${JSON.stringify(input)}`);
    for (const seed of SEEDS) {
      console.log(`  [${String(seed).padStart(4)}] ${page.transform(input, seed)}`);
    }
  }
  process.exit(0);
}

// Artifact report: doubled words that are not legitimate literary repeats.
const LEGIT = /^Ho ho|^Yo ho ho|^Yes, yes|^Ha ha|^Oh ho/i;
const snap = JSON.parse(readFileSync(join(ROOT, 'tools', 'baseline.json'), 'utf8'));

for (const file of Object.keys(snap)) {
  const found = new Map();
  for (const key of Object.keys(snap[file].results)) {
    const out = snap[file].results[key];
    const m = out.match(/\b([A-Za-z']+) \1\b/i);
    if (!m || LEGIT.test(out)) continue;
    const rec = found.get(m[1].toLowerCase()) || { n: 0, ex: [] };
    rec.n++;
    if (rec.ex.length < 3) rec.ex.push({ in: key.split('::')[1], out });
    found.set(m[1].toLowerCase(), rec);
  }
  if (!found.size) continue;
  console.log(`\n${'='.repeat(70)}\n${file}`);
  for (const [word, rec] of [...found].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`\n  "${word}" doubled ${rec.n}x`);
    for (const e of rec.ex) {
      console.log(`    in : ${JSON.stringify(e.in)}`);
      console.log(`    out: ${JSON.stringify(e.out)}`);
    }
  }
}
