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
// Matched on word boundaries. Substring matching is wrong here: it flagged
// "arse" inside "coarser" and "prick" inside the pricking of my thumbs.
const PROFANITY = [
  'fuck', 'fucking', 'shit', 'bullshit', 'piss', 'pissed', 'wank', 'bollocks',
  'bugger', 'bastard', 'twat', 'wanker', 'cunt', 'arsehole', 'arse', 'dickhead',
];
const EXPLICIT = [
  'sex', 'sexual', 'sexy', 'naked', 'nude', 'nudity', 'erection', 'penis',
  'vagina', 'boobs', 'breasts', 'orgasm', 'porn', 'prostitute', 'whore',
  'slut', 'bitch', 'rape', 'raped', 'molest', 'incest', 'paedophile', 'pedophile',
];
// Kept deliberately short and specific: these are slurs, not a thesaurus of
// historical English. Generic insults like "fool" or "coward" are the point of
// the roasts and are not family-unfriendly.
const SLURS = [
  'nigger', 'nigga', 'faggot', 'faggots', 'kike', 'spic', 'chink', 'wetback',
  'tranny', 'retard', 'retarded', 'paki', 'coon', 'gook', 'raghead', 'towelhead',
  'shemale', 'dyke', 'jap',
];

// Reviewed exceptions, each with the reason it is allowed. Anything listed here
// should be re-read if the corpus changes.
const ALLOWED = [
  [/Out, damned spot!/i,
    'canonical Macbeth; "damned" means condemned here, not the oath "damn"'],
  [/pricking of my thumbs/i, 'canonical Macbeth, non-sexual sense of "prick"'],
  [/If you prick us/i, 'canonical Merchant of Venice, non-sexual sense of "prick"'],
  [/coarser than a toad/i, 'a Shakespeare line; "arse" appears inside "coarser"'],
  [/bilge monkey/i,
    'Golden Age nautical ribaldry, no slur implication -- FLAGGED FOR REVIEW, see report'],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function scan(kind, terms) {
  const hits = [];
  for (const { page, text } of corpus) {
    const lower = text.toLowerCase();
    for (const t of terms) {
      if (new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(lower)) hits.push({ page, text, t });
    }
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
const SERVITUDE = ['slave', 'slaves', 'thrall', 'thralls', 'serf', 'bondswoman', 'bondman'];
const servitudeRoasts = [];
for (const page of PAGES) {
  for (const t of arraysFrom(`${page}.html`, ['insults']).insults) {
    for (const w of SERVITUDE) {
      if (new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(t)) servitudeRoasts.push([page, t]);
    }
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
