// Yoda transform gate: object fronting, infinitive fronting, the strict
// object guard, and the word-table rules that used to garble reordered
// sentences. Everything runs through the page's own yodaify() with a fixed
// seed, so a failure here is a real behaviour change, not RNG drift.
//   node tools/test-yoda.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const yoda = loadPage(join(ROOT, 'yoda.html'), 'yodaify');

const SEED = 42;
let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };

// --- exact outputs (seed 42) -------------------------------------------------

console.log('\nexact outputs (seed 42)');

const EXACT = [
  ['I like pie', 'Pie, I like'],
  ['I love the bright sun', 'The bright sun, I love'],
  ['he whispered a terrible secret', 'A terrible secret, he whispered'],
  ['the old king ruled the land', 'The land, the old king ruled'],
  ['you are brave', 'Are you brave'],
  ['I want to find the lost treasure.', 'To find the lost treasure, I want.'],
  ['You need to leave the old temple.', 'To leave the old temple, you need.'],
];

for (const [input, want] of EXACT) {
  const got = yoda.transform(input, SEED);
  if (got === want) ok(`${JSON.stringify(input)} -> ${JSON.stringify(got)}`);
  else no(`${JSON.stringify(input)}\n        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`);
}

// --- the object guard refuses these ------------------------------------------

console.log('\nobject guard (seed 42)');

// A prepositional phrase inside the object: nothing may be fronted.
{
  const out = yoda.transform('The dog chased the cat up the tree.', SEED);
  const lower = out.toLowerCase();
  const noComma = !out.includes(',');
  const order = lower.indexOf('dog') >= 0 && lower.indexOf('dog') < lower.indexOf('the cat');
  if (noComma && order) ok(`PP inside object left alone: ${JSON.stringify(out)}`);
  else no(`PP inside object mangled: ${JSON.stringify(out)}`);
}

// "lost" must survive as an adjective: the old verb rule said "was vanquished".
{
  const out = yoda.transform('I want to find the lost treasure.', SEED);
  if (!out.includes('was vanquished') && out.includes('lost')) {
    ok(`no "was vanquished" garbling: ${JSON.stringify(out)}`);
  } else {
    no(`word table garbled "lost": ${JSON.stringify(out)}`);
  }
}

// Infinitive fronting takes pronoun subjects only.
{
  const out = yoda.transform('The dog wants to chase the cat.', SEED);
  if (!out.includes(',')) ok(`non-pronoun subject not fronted: ${JSON.stringify(out)}`);
  else no(`fronted a non-pronoun subject: ${JSON.stringify(out)}`);
}

// The rule accepts up to five words after "to"; longer phrases stay put.
{
  const out = yoda.transform('I want to find the really big treasure today', SEED);
  if (!/^To /.test(out)) ok(`long infinitive phrase left in order: ${JSON.stringify(out)}`);
  else no(`fronted a >5-word infinitive: ${JSON.stringify(out)}`);
}

// --- long inputs: words are reordered, never dropped or doubled --------------

console.log('\nlong inputs (seed 42)');

// Chosen to hit no word-table key, so the only legal changes are structural
// reordering plus additive flourishes (openings, asides). The precondition
// below proves the table really leaves them alone.
const LONG = [
  'the brave knight rode swiftly into the dark forest before the morning star appeared',
  'will you help me find the secret treasure in the old ruins tonight?',
  'she said that he was coming and they would linger by the river until morning',
];

// Function words: shared with insertions, so their counts may legitimately
// rise. Content words must all survive.
const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'by', 'from', 'into', 'before', 'until', 'that', 'he', 'she', 'they',
  'we', 'you', 'i', 'it', 'is', 'was', 'were', 'would', 'will', 'me', 'my',
]);

function words(text) {
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

for (const input of LONG) {
  const core = yoda.api.replaceAll(input);
  if (core.toLowerCase() !== input.toLowerCase()) {
    no(`test input ${JSON.stringify(input)} hits the word table (${JSON.stringify(core)}); pick a cleaner one`);
    continue;
  }
  const out = yoda.transform(input, SEED);
  const outWords = words(out);
  const problems = [];
  if (!out.trim()) problems.push('empty output');
  if (/\b(\w+) \1\b/i.test(out)) problems.push('doubled word');
  if (/[a-z],[a-z]/.test(out)) problems.push('fused comma');
  const counts = new Map();
  for (const w of outWords) counts.set(w, (counts.get(w) || 0) + 1);
  for (const w of words(input)) {
    if (STOP.has(w)) continue;
    if (!counts.has(w)) { problems.push(`dropped ${JSON.stringify(w)}`); break; }
    counts.set(w, counts.get(w) - 1);
  }
  if (problems.length) {
    no(`${JSON.stringify(input)}: ${problems.join('; ')}\n        got ${JSON.stringify(out)}`);
  } else {
    ok(`${JSON.stringify(input.slice(0, 48))}... intact (${outWords.length} words)`);
  }
}

console.log(failures ? `\n${failures} yoda check(s) failed` : '\nevery yoda check passed');
process.exitCode = failures ? 1 : 0;
