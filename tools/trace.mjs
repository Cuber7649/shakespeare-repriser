// Replays the original multi-pass chain one dictionary at a time, printing the
// text after each pass so the cascade failure mode is visible.
//   node tools/trace.mjs "it is very good but actually quite bad" [page]

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = {
  shakespeare: ['shakespeare.html', 'shakespearify'],
  pirate: ['pirate.html', 'pirateify'],
  victorian: ['victorian.html', 'victorianify'],
  chaucer: ['chaucer.html', 'chaucerify'],
  yoda: ['yoda.html', 'yodaify'],
  norse: ['norse.html', 'norseify'],
};

const text = process.argv[2] || 'it is very good but actually quite bad';
const which = process.argv[3] || 'shakespeare';
const [file, entry] = PAGES[which];
const page = loadPage(join(ROOT, file), entry);
const a = page.api;

const CHAIN = [
  'sentenceTransforms', 'contractions', 'negatives', 'pronouns',
  'verbForms', 'commonWords', 'verbs', 'adjectives', 'nouns',
];

console.log(`\n${file}   input: ${JSON.stringify(text)}\n${'-'.repeat(74)}`);

let s = text;
for (const name of CHAIN) {
  const list = a[name];
  if (!list) continue;

  const entries = name === 'negatives'
    ? Object.entries(list).map(([k, v]) => [new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), v])
    : list;

  // The real engine runs one whole-sentence replace PER RULE, not one per
  // dictionary, so every rule can rewrite what the previous rules produced.
  for (const [pat, rep] of entries) {
    const before = s;
    s = s.replace(pat, rep);
    if (s !== before) {
      console.log(`\n  ${name}  /${pat.source}/${pat.flags} -> ${JSON.stringify(rep)}`);
      console.log(`    in  : ${JSON.stringify(before)}`);
      console.log(`    out : ${JSON.stringify(s)}`);
    }
  }
}

console.log(`\n${'-'.repeat(74)}\nfinal: ${JSON.stringify(s)}`);
console.log(`page  : ${JSON.stringify(page.transform(text, 1))}`);

// yoda's missing \b check
if (which === 'yoda') {
  console.log(`\n${'='.repeat(74)}\nLeading-\\b audit for yoda.html:`);
  for (const name of ['commonWords', 'verbs', 'adjectives', 'nouns', 'verbForms',
    'pronouns', 'contractions', 'sentenceTransforms']) {
    const bad = (a[name] || []).filter(([re]) => !re.source.startsWith('\\b'));
    if (bad.length) {
      console.log(`  ${name}: ${bad.length} rule(s) missing a leading \\b`);
      for (const [re, rep] of bad) console.log(`      /${re.source}/${re.flags} -> ${JSON.stringify(rep)}`);
    }
  }
  for (const probe of ['grandchild', 'notebook', 'animate', 'bigger', 'swordfish', 'lifebook']) {
    const out = page.transform(probe, 1);
    console.log(`  ${JSON.stringify(probe).padEnd(13)} -> ${JSON.stringify(out)}`);
  }
}
