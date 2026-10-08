// Verifies every string the README quotes actually exists in the code.
//
// Behavioural sampling is unreliable for these: a 5% insult roll spread over
// ~20 entries is ~0.25% per run, so surfacing one specific entry needs
// thousands of seeds. Checking that the quoted text exists in the page's arrays
// is deterministic and is what actually validates the docs.
//   node tools/readme-features.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = {
  shakespeare: ['shakespeare.html', 'shakespearify'],
  pirate: ['pirate.html', 'pirateify'],
  victorian: ['victorian.html', 'victorianify'],
  chaucer: ['chaucer.html', 'chaucerify'],
  yoda: ['yoda.html', 'yodaify'],
  norse: ['norse.html', 'norseify'],
};

const pages = {};
for (const [k, [file, entry]] of Object.entries(PAGES)) {
  pages[k] = loadPage(join(ROOT, file), entry);
}

// Every string the README quotes, and where it must be findable. These are all
// SINGLE literals: composed outputs like "ye be my matey" are no single array
// element, so they belong in the behavioural checks below, not here.
const QUOTES = [
  ['shakespeare', 'dost thou fare', 'transform'],
  ['shakespeare', 'He draws his sword', 'stage direction'],
  ['pirate', 'yearning to', 'transform'],
  ['pirate', 'scurvy dog', 'insult'],
  ['victorian', 'truly', 'transform'],
  ['victorian', 'one is', 'transform'],
  ['victorian', 'insufferable bounder', 'insult'],
  ['chaucer', 'blisful', 'transform'],
  ['chaucer', 'thou dost nat', 'transform'],
  ['chaucer', 'thou cherl', 'insult'],
  ['norse', 'merry', 'transform'],
  ['norse', 'my heart hungereth to', 'transform'],
  ['norse', 'ye do not', 'transform'],
  ['norse', 'berserker', 'metaphor'],
  ['norse', 'longship', 'stage direction'],
];

// Collect every user-visible string in a page: array elements, object values,
// and the right-hand side of every replacement rule.
function harvest(page) {
  const out = [];
  const add = (v) => { if (typeof v === 'string') out.push(v); };
  for (const [name, val] of Object.entries(page.api)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') add(item);
        else if (Array.isArray(item)) {
          const rhs = item[1];
          if (typeof rhs === 'string') add(rhs);
          else if (typeof rhs === 'function') out.push(rhs.toString());
          if (item[0] && item[0].source) out.push(item[0].source);
        }
      }
    } else if (val && typeof val === 'object') {
      for (const v of Object.values(val)) add(v);
    } else {
      add(val);
    }
  }
  return out;
}

const haystacks = {};
for (const k of Object.keys(pages)) haystacks[k] = harvest(pages[k]).join(' | ');

console.log('\n=== README quoted strings: existence check ===\n');
let bad = 0;
for (const [style, needle, where] of QUOTES) {
  const found = haystacks[style].toLowerCase().includes(needle.toLowerCase());
  if (!found) bad++;
  console.log(`${found ? 'OK  ' : 'MISS'}  ${style.padEnd(11)} ${JSON.stringify(needle).padEnd(30)} (${where})`);
}

// Behavioural spot-checks for the deterministic-looking claims.
console.log('\n=== behavioural spot-checks (5 seeds) ===\n');
const SPOT = [
  ['how are you', 'shakespeare', 'dost thou fare'],
  ['you are my friend', 'pirate', 'ye be my matey'],
  ['you are happy', 'chaucer', 'thou art blisful'],
  ['you are happy', 'norse', 'ye are merry'],
  ['you are brave', 'yoda', 'Are you brave'],
  ['I like pie', 'yoda', 'Pie, I like'],
  ['he whispered a terrible secret', 'yoda', 'terrible secret, he whispered'],
  ['you are', 'victorian', 'one is'],
  ['I want to go', 'norse', 'my heart hungereth to'],
  ['I want to go', 'pirate', 'yearning to'],
  ["you don't go", 'chaucer', 'thou dost nat'],
  ["you don't go", 'norse', 'ye do not'],
];
for (const [input, style, needle] of SPOT) {
  const hits = SEEDS.filter((s) =>
    pages[style].transform(input, s).toLowerCase().includes(needle.toLowerCase()));
  const ok = hits.length > 0;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'MISS'}  ${style.padEnd(11)} ${JSON.stringify(input).padEnd(22)} -> contains ${JSON.stringify(needle)} (${hits.length}/${SEEDS.length} seeds)`);
}

console.log(bad ? `\n${bad} claim(s) unsupported` : '\nevery README claim is supported');
process.exitCode = bad ? 1 : 0;
