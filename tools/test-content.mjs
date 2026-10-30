// Family-friendliness and data-integrity gate for the word lists the style pages
// can actually display.
//
//   node tools/test-content.mjs
//
// Mechanical, not a judgement call: it fails the build if a profanity, slur or
// explicit term reaches any line in the six styles' quotes or roasts, and it
// locks in the content decisions made for this project. Roasts may not use
// slavery or servitude as the punchline; quotes may mention slavery when arguing
// against it (two pirate lines do), so that check is scoped to the roasts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PROFANITY, EXPLICIT, SLURS, SERVITUDE, ALLOWED, scanTerms } from './content-policy.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['shakespeare', 'pirate', 'victorian', 'chaucer', 'yoda', 'norse'];

let failures = 0;
let warnings = 0;
const fail = (m) => { console.log(`  FAIL  ${m}`); failures++; };
const warn = (m) => { console.log(`  WARN  ${m}`); warnings++; };
const ok = (m) => console.log(`  ok    ${m}`);

function arraysFrom(file, names) {
  const s = readFileSync(join(ROOT, file), 'utf8');
  const out = {};
  for (const n of names) {
    const i = s.indexOf(`const ${n} = [`);
    if (i < 0) throw new Error(`${n} not found in ${file}`);
    let d = 0; const o = s.indexOf('[', i); let j = o;
    for (; j < s.length; j++) { if (s[j] === '[') d++; else if (s[j] === ']') { d--; if (!d) break; } }
    out[n] = eval(s.slice(o, j + 1));
  }
  return out;
}

const corpus = [];
for (const page of PAGES) {
  const { quotes, insults } = arraysFrom(`${page}.html`, ['quotes', 'insults']);
  quotes.forEach((t) => corpus.push({ page, kind: 'quote', text: t }));
  insults.forEach((t) => corpus.push({ page, kind: 'roast', text: t }));
}

// --- family-friendly vocabulary -------------------------------------------------
// The lists and reviewed exceptions live in content-policy.mjs so that
// tools/check-words.mjs checks a candidate against exactly the same policy.
function scan(kind, terms) {
  const hits = [];
  for (const { page, text } of corpus) {
    for (const term of scanTerms(text, terms)) hits.push({ page, text, t: term });
  }
  for (const h of hits) fail(`${kind} term "${h.t}" in ${h.page}: "${h.text.slice(0, 60)}"`);
  return hits.length;
}

console.log(`corpus: ${corpus.length} lines across ${PAGES.length} styles\n`);

console.log('family-friendly');
scan('profanity', PROFANITY) === 0 && ok(`no profanity across ${corpus.length} lines`);
scan('explicit', EXPLICIT) === 0 && ok('no explicit or sexual terms');
scan('slur', SLURS) === 0 && ok('no slurs');

for (const [, reason] of ALLOWED) {
  if (/FLAGGED FOR REVIEW/.test(reason)) warn(reason);
}

// --- slavery only as a punchline ------------------------------------------------
const servitudeRoasts = [];
for (const page of PAGES) {
  for (const t of arraysFrom(`${page}.html`, ['insults']).insults) {
    for (const w of scanTerms(t, SERVITUDE)) servitudeRoasts.push([page, t, w]);
  }
}
if (servitudeRoasts.length) {
  for (const [p, t] of servitudeRoasts) fail(`roast uses servitude as a punchline: ${p} "${t}"`);
} else {
  ok('no roast uses slavery or servitude as a punchline');
}

// --- no duplicates --------------------------------------------------------------
let dupes = 0;
for (const page of PAGES) {
  const { quotes, insults } = arraysFrom(`${page}.html`, ['quotes', 'insults']);
  for (const [kind, list] of [['quote', quotes], ['roast', insults]]) {
    const seen = new Set();
    for (const t of list) {
      const key = t.toLowerCase().replace(/[^a-z ]/g, '').trim();
      if (seen.has(key)) { fail(`${page}/${kind} duplicate: "${t}"`); dupes++; }
      seen.add(key);
    }
  }
}
if (!dupes) ok('no duplicate lines within any style');

// --- pool sizes -----------------------------------------------------------------
let thin = 0;
for (const page of PAGES) {
  const { quotes, insults } = arraysFrom(`${page}.html`, ['quotes', 'insults']);
  const bad = [];
  if (!insults.length) bad.push('0 roasts');
  if (!quotes.length) bad.push('0 quotes');
  if (bad.length) { fail(`${page}: ${bad.join(', ')}`); thin++; }
}
const totalRoasts = PAGES.reduce((n, p) => n + arraysFrom(`${p}.html`, ['insults']).insults.length, 0);
const totalQuotes = PAGES.reduce((n, p) => n + arraysFrom(`${p}.html`, ['quotes']).quotes.length, 0);
if (!thin) ok(`pools populated: ${totalRoasts} roasts, ${totalQuotes} quotes`);

console.log('');
if (warnings) console.log(`${warnings} warning(s) needing a human decision`);
if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
console.log('all content checks passed');
