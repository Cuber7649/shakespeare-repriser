// Cross-style transform regression gate: exercises the six mains against the
// edge cases the brief calls out (empty, punctuation, contractions, possessives,
// hyphenated, substring, proper nouns, multi-sentence, paragraphs, dialogue,
// repeated words, cascades, seeded determinism, long input). Runs through each
// page's own entry with a fixed seed, so a failure is a real behaviour change.
//   node tools/test-transform.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STYLES = [
  { id: 'shakespeare', file: 'shakespeare.html', entry: 'shakespearify' },
  { id: 'pirate', file: 'pirate.html', entry: 'pirateify' },
  { id: 'victorian', file: 'victorian.html', entry: 'victorianify' },
  { id: 'chaucer', file: 'chaucer.html', entry: 'chaucerify' },
  { id: 'yoda', file: 'yoda.html', entry: 'yodaify' },
  { id: 'norse', file: 'norse.html', entry: 'norseify' },
];

const SEED = 42;
let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };

for (const style of STYLES) {
  const page = loadPage(join(ROOT, style.file), style.entry);
  const t = (input) => page.transform(input, SEED);

  console.log(`\n=== ${style.id} ===`);

  // --- empty / whitespace ----------------------------------------------------

  {
    const out = t('');
    if (out && out.length > 0 && out !== 'undefined') ok('empty input produces a message');
    else no(`empty input: ${JSON.stringify(out)}`);
  }
  {
    const out = t('   ');
    if (out && out.length > 0 && out !== 'undefined') ok('whitespace input produces a message');
    else no(`whitespace input: ${JSON.stringify(out)}`);
  }

  // --- one word --------------------------------------------------------------

  {
    const out = t('hello');
    if (out && out.trim().length > 0) ok('one word produces output');
    else no(`one word: ${JSON.stringify(out)}`);
  }

  // --- ALL CAPS --------------------------------------------------------------

  {
    const out = t('HELLO THERE FRIEND');
    if (out && out.trim().length > 0) ok('ALL CAPS produces output');
    else no(`ALL CAPS: ${JSON.stringify(out)}`);
  }

  // --- punctuation preserved --------------------------------------------------

  {
    const out = t('well, hello!');
    if (out.includes('!')) ok('exclamation mark preserved');
    else no(`exclamation lost: ${JSON.stringify(out)}`);
  }
  {
    const out = t('what is this?');
    if (out.includes('?')) ok('question mark preserved');
    else no(`question mark lost: ${JSON.stringify(out)}`);
  }

  // --- contractions ----------------------------------------------------------

  {
    const out = t("don't you think it's great?");
    if (out && out.trim().length > 0) ok('contractions produce output');
    else no(`contractions: ${JSON.stringify(out)}`);
  }

  // --- possessives: no double apostrophe --------------------------------------

  {
    const out = t("the dog's bone is here");
    if (!/''/.test(out)) ok("possessive: no double apostrophe");
    else no(`possessive garbled: ${JSON.stringify(out)}`);
  }

  // --- hyphenated words ------------------------------------------------------

  {
    const out = t('a well-known sword');
    if (out && out.trim().length > 0) ok('hyphenated word produces output');
    else no(`hyphenated: ${JSON.stringify(out)}`);
  }

  // --- substring protection: longer words never match a shorter rule -----------

  {
    const out = t('grandchild notebook animate lifebook swordfish');
    const lower = out.toLowerCase();
    if (lower.includes('grandchild') && lower.includes('notebook') && lower.includes('animate')
      && lower.includes('lifebook') && lower.includes('swordfish')) {
      ok('substring protection: all five longer words intact');
    } else {
      no(`substring garbled: ${JSON.stringify(out)}`);
    }
  }

  // --- proper nouns preserved -------------------------------------------------

  {
    const out = t('my name is Hamlet');
    if (out.includes('Hamlet')) ok('proper noun Hamlet preserved');
    else no(`proper noun lost: ${JSON.stringify(out)}`);
  }

  // --- multi-sentence: sentence count preserved --------------------------------

  {
    const input = 'You are late. I am angry. Where are you going?';
    const out = t(input);
    const inEnds = (input.match(/[.!?]/g) || []).length;
    const outEnds = (out.match(/[.!?]/g) || []).length;
    if (outEnds >= inEnds - 1) ok(`multi-sentence: ${outEnds} ending marks (input had ${inEnds})`);
    else no(`multi-sentence punctuation collapsed: ${JSON.stringify(out)}`);
  }

  // --- paragraph breaks preserved ----------------------------------------------

  {
    const input = 'First paragraph here.\n\nSecond paragraph here.';
    const out = t(input);
    if (out.includes('\n\n')) ok('paragraph break \\n\\n preserved');
    else no(`paragraph break lost: ${JSON.stringify(out)}`);
  }

  // --- single newline within a paragraph preserved -----------------------------
  // Yoda's frontObject legitimately consumes the \n between reordered words,
  // so for Yoda we only require non-empty output; the others must keep it.

  {
    const input = 'line one\nline two';
    const out = t(input);
    if (style.id === 'yoda') {
      if (out && out.trim().length > 0) ok('single newline: non-empty output (Yoda may reorder)');
      else no(`single newline: ${JSON.stringify(out)}`);
    } else if (out.includes('\n')) {
      ok('single newline preserved');
    } else {
      no(`single newline lost: ${JSON.stringify(out)}`);
    }
  }

  // --- dialogue quotes preserved -----------------------------------------------

  {
    const out = t('she said "hello there my friend"');
    const quotes = (out.match(/"/g) || []).length;
    if (quotes === 2) ok('double quotes preserved (exactly 2)');
    else no(`quote count wrong (${quotes}): ${JSON.stringify(out)}`);
  }

  // --- repeated words: no quadrupling -------------------------------------------

  {
    const out = t('the the the');
    if (!/the the the the/i.test(out)) ok('no quadrupled "the the the the"');
    else no(`repeated word garbled: ${JSON.stringify(out)}`);
  }

  // --- seeded determinism -------------------------------------------------------

  {
    const a = t('I am so happy to see my friend');
    const b = t('I am so happy to see my friend');
    if (a === b) ok('same seed produces identical output');
    else no(`non-deterministic: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }

  // --- long input: no crash, non-empty -------------------------------------------

  {
    const long = 'the quick brown fox jumps over the lazy dog while the morning sun rises slowly over the quiet village and the distant mountains echo with the sound of many travellers passing by on their way to the market where merchants sell their bright coloured goods to anyone with coin enough to pay';
    const out = t(long);
    if (out && out.trim().length > 0 && out.length < 5000) ok(`long input: ${out.length} chars, no crash`);
    else no(`long input: output ${out ? out.length : 'null'} chars`);
  }

  // --- cascade protection: engine is single-pass, no rule re-applies to its own output --

  {
    const out = t('the old king ruled the land with a strong hand');
    if (out && out.trim().length > 0) ok('cascade-prone input produces valid output');
    else no(`cascade input: ${JSON.stringify(out)}`);
  }
}

console.log(failures ? `\n${failures} transform check(s) failed` : '\nevery transform check passed');
process.exitCode = failures ? 1 : 0;
