// Audits every replacement rule to see whether it is a pure literal
// (^ \b word-word \b $ with only letters, apostrophes, hyphens, spaces)
// or needs the regex fallback path.
//   node tools/audit-rules.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  ['shakespeare.html', 'shakespearify'],
  ['pirate.html', 'pirateify'],
  ['victorian.html', 'victorianify'],
  ['chaucer.html', 'chaucerify'],
  ['yoda.html', 'yodaify'],
  ['norse.html', 'norseify'],
];

const DICTIONARIES = [
  'sentenceTransforms', 'contractions', 'pronouns', 'verbForms',
  'commonWords', 'verbs', 'adjectives', 'nouns',
];

// \b ... \b where the body is only word chars, apostrophes, hyphens, spaces.
const LITERAL = /^\\b[A-Za-z'’-]*(?:[ \t]+[A-Za-z'’-]+)*\\b$/;
const WORDY = /^[A-Za-z'’-]+(?:[ \t]+[A-Za-z'’-]+)*$/;

const seen = new Map(); // literal -> competing replacements, across all pages
let grandTotal = 0;
let grandNonLiteral = 0;

for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  const nonLiteral = [];
  let total = 0;
  const flagsSeen = new Set();

  for (const name of DICTIONARIES) {
    const list = page.api[name];
    if (!list) continue;
    for (const [re, rep] of list) {
      total++;
      flagsSeen.add(re.flags);
      if (!LITERAL.test(re.source)) {
        nonLiteral.push(`${name}: /${re.source}/${re.flags}`);
        continue;
      }
      const lit = re.source.slice(2, -2);
      if (!WORDY.test(lit)) {
        nonLiteral.push(`${name}: /${re.source}/${re.flags} (odd body)`);
        continue;
      }
      // conflicting rules for the same literal within this page
      if (!seen.has(lit)) seen.set(lit, new Map());
      const byFile = seen.get(lit);
      if (!byFile.has(file)) byFile.set(file, new Set());
      byFile.get(file).add(`${name}:${String(rep)}`);
    }
  }

  // negatives are plain string -> string, always literal
  let negTotal = 0;
  if (page.api.negatives) {
    for (const [k, v] of Object.entries(page.api.negatives)) {
      negTotal++;
      if (!WORDY.test(k)) nonLiteral.push(`negatives key: ${JSON.stringify(k)}`);
      else if (!seen.has(k)) seen.set(k, new Map());
    }
  }

  grandTotal += total + negTotal;
  grandNonLiteral += nonLiteral.length;

  console.log(`\n${'='.repeat(70)}\n${file}   ${total + negTotal} rules   flags: ${[...flagsSeen].join(',')}`);
  if (nonLiteral.length) {
    console.log(`  ${nonLiteral.length} NON-LITERAL (need regex fallback):`);
    for (const n of nonLiteral) console.log(`    ${n}`);
  } else {
    console.log('  all rules are pure literals');
  }
}

console.log(`\n${'='.repeat(70)}`);
console.log(`TOTAL rules: ${grandTotal}   non-literal: ${grandNonLiteral}`);

// Same literal, different replacement, within one page -> genuine ambiguity.
const conflicts = [];
for (const [lit, byFile] of seen) {
  for (const [file, reps] of byFile) {
    if (reps.size > 1) conflicts.push({ lit, file, reps: [...reps] });
  }
}
console.log(`\nDuplicate literals with CONFLICTING replacements: ${conflicts.length}`);
for (const c of conflicts.sort((a, b) => b.reps.length - a.reps.length)) {
  console.log(`\n  ${JSON.stringify(c.lit)}  (${c.file})`);
  for (const r of c.reps) console.log(`      ${r}`);
}

// Typos in the word lists themselves: doubled words in a replacement, and
// overlapping rules inside one array where a short rule shadows a long one.
console.log(`\n${'='.repeat(70)}\nDoubled words inside replacement text:`);
let typoCount = 0;
for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  const found = [];
  for (const name of [...DICTIONARIES, 'openings', 'midInsertions', 'insults', 'quotes', 'asides']) {
    const list = page.api[name];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const rep = Array.isArray(item) ? item[1] : item;
      if (typeof rep !== 'string') continue;
      const m = rep.match(/\b([A-Za-z']+) \1\b/i);
      if (m && !/^(Ho ho|Yo ho ho|Yes, yes|Ha ha)/i.test(rep)) {
        found.push(`${name}: ${JSON.stringify(rep)}`);
      }
    }
  }
  if (found.length) {
    typoCount += found.length;
    console.log(`\n  ${file}`);
    for (const f of found) console.log(`      ${f}`);
  }
}
if (!typoCount) console.log('  none');

console.log(`\n${'='.repeat(70)}\nShort rule shadowing a longer rule in the SAME array:`);
let shadowCount = 0;
for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  const notes = [];
  for (const name of DICTIONARIES) {
    const list = page.api[name];
    if (!list) continue;
    const lits = list.filter(([re]) => LITERAL.test(re.source))
      .map(([re, rep]) => ({ lit: re.source.slice(2, -2).toLowerCase(), rep }))
      .filter((x) => WORDY.test(x.lit));
    for (const a of lits) {
      for (const b of lits) {
        if (a === b || a.lit === b.lit) continue;
        // b.lit starts with a.lit -> the short one can shadow the long one
        if (b.lit.startsWith(a.lit + ' ') && lits.indexOf(a) < lits.indexOf(b)) {
          notes.push(`${name}: ${JSON.stringify(a.lit)} (earlier) shadows ${JSON.stringify(b.lit)}`);
        }
      }
    }
  }
  if (notes.length) {
    shadowCount += notes.length;
    console.log(`\n  ${file}`);
    for (const n of [...new Set(notes)]) console.log(`      ${n}`);
  }
}
if (!shadowCount) console.log('  none');

// Self-prefixed replacements: a rule that maps a word to itself with an
// article glued on front ("rain" -> "the rain"), so "the rain" becomes
// "the the rain".
console.log(`\n${'='.repeat(70)}\nSelf-prefixed replacements (literal + article):`);
let selfCount = 0;
for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  const found = [];
  for (const name of DICTIONARIES) {
    const list = page.api[name];
    if (!list) continue;
    for (const [pat, rep] of list) {
      const l = typeof pat === 'string' ? pat : (LITERAL.test(pat.source) ? pat.source.slice(2, -2) : null);
      if (!l || typeof rep !== 'string') continue;
      const low = rep.trim().toLowerCase();
      if (low === `the ${l.toLowerCase()}` || low === `a ${l.toLowerCase()}` ||
          low === `an ${l.toLowerCase()}`) {
        found.push(`${name.padEnd(18)} ${JSON.stringify(l).padEnd(12)} -> ${JSON.stringify(rep)}`);
      }
    }
  }
  if (found.length) {
    selfCount += found.length;
    console.log(`\n  ${file}`);
    for (const f of found) console.log(`      ${f}`);
  }
}
if (!selfCount) console.log('  none');
