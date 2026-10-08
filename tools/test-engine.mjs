// Compares the single-pass engine against the current sequential chain, in
// isolation from the random insertions, so the diff shows only engine effects.
//   node tools/test-engine.mjs [--show N]

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { makeReplacer, oldChain, CHAIN_NAMES } from './engine-proto.mjs';
import { CORPUS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const showAt = process.argv.indexOf('--show');
const SHOW = showAt > -1 ? Number(process.argv[showAt + 1]) : 10;

const PAGES = [
  ['shakespeare.html', 'shakespearify'],
  ['pirate.html', 'pirateify'],
  ['victorian.html', 'victorianify'],
  ['chaucer.html', 'chaucerify'],
  ['yoda.html', 'yodaify'],
  ['norse.html', 'norseify'],
];

// The page splits on sentence boundaries the same way; mirror it.
const SENTENCE_SPLIT = /[^.!?]*[.!?]+|[^.!?]+/g;

const BAD = [
  [/\b(\w+) \1\b/i, 'doubled word'],
  [/[a-z],[a-z]/, 'comma fused to next word'],
];

let grandOld = 0;
let grandNew = 0;
let grandSame = 0;
const rows = [];

for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  const dicts = CHAIN_NAMES.map((n) => page.api[n]).filter(Boolean);
  const oldFn = oldChain(dicts);
  const newFn = makeReplacer(dicts);

  let changed = 0;
  let same = 0;
  let oldBad = 0;
  let newBad = 0;
  const samples = [];

  for (const input of CORPUS) {
    for (const s0 of input.match(SENTENCE_SPLIT) || [input]) {
      const s = s0.trim();
      if (!s) continue;
      const before = oldFn(s);
      const after = newFn(s);
      for (const [re] of BAD) {
        if (re.test(before)) oldBad++;
        if (re.test(after)) newBad++;
      }
      if (before === after) { same++; continue; }
      changed++;
      if (samples.length < SHOW) samples.push({ s, before, after });
    }
  }

  grandOld += oldBad;
  grandNew += newBad;
  grandSame += same;
  rows.push({ file, changed, same, oldBad, newBad, samples });
}

console.log(`\n${'page'.padEnd(19)} ${'changed'.padStart(8)} ${'same'.padStart(6)}   defects (old -> new)`);
console.log('-'.repeat(66));
for (const r of rows) {
  const delta = r.newBad - r.oldBad;
  const mark = delta < 0 ? `  ${delta}` : delta > 0 ? `  +${delta} WORSE` : '  =';
  console.log(
    `${r.file.padEnd(19)} ${String(r.changed).padStart(8)} ${String(r.same).padStart(6)}   ` +
    `${String(r.oldBad).padStart(4)} -> ${String(r.newBad).padEnd(4)}${mark}`
  );
}
console.log('-'.repeat(66));
console.log(`${'TOTAL'.padEnd(19)} ${String(grandSame).padStart(8)}          defects ${grandOld} -> ${grandNew}`);

if (showAt > -1) {
  for (const r of rows) {
    if (!r.samples.length) continue;
    console.log(`\n${'='.repeat(74)}\n${r.file}`);
    for (const s of r.samples) {
      console.log(`\n  in   : ${JSON.stringify(s.s)}`);
      console.log(`  old  : ${JSON.stringify(s.before)}`);
      console.log(`  new  : ${JSON.stringify(s.after)}`);
    }
  }
}
