// Lists every rule across a page's dictionaries for a given literal, in the
// order the engine will consider them.
//   node tools/lookup.mjs norse "won"
//   node tools/lookup.mjs shakespeare "stay"

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { CHAIN_NAMES } from './engine-proto.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = {
  shakespeare: ['shakespeare.html', 'shakespearify'],
  pirate: ['pirate.html', 'pirateify'],
  victorian: ['victorian.html', 'victorianify'],
  chaucer: ['chaucer.html', 'chaucerify'],
  yoda: ['yoda.html', 'yodaify'],
  norse: ['norse.html', 'norseify'],
};

const which = process.argv[2] || 'shakespeare';
const needle = (process.argv[3] || 'won').toLowerCase();
const [file, entry] = PAGES[which];
const page = loadPage(join(ROOT, file), entry);

console.log(`\n${file}   rules whose literal contains ${JSON.stringify(needle)}\n`);
let rank = 0;
for (const name of CHAIN_NAMES) {
  const dict = page.api[name];
  if (!dict) continue;
  const pairs = Array.isArray(dict) ? dict : Object.entries(dict);
  for (const [pat, rep] of pairs) {
    const lit = typeof pat === 'string' ? pat : pat.source.replace(/^\\b/, '').replace(/\\b$/, '');
    const r = rank++;
    if (lit.toLowerCase().includes(needle)) {
      console.log(
        `  rank ${String(r).padStart(4)}  ${name.padEnd(20)} ` +
        `${JSON.stringify(lit).padEnd(22)} -> ${JSON.stringify(rep)}` +
        (typeof pat === 'string' ? '   (negatives)' : '')
      );
    }
  }
}
console.log();
