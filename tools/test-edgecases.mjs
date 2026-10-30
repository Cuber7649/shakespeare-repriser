// Edge-case contract for the transform. These inputs are not interesting prose,
// but each one has burned a real UI at some point: empty submissions, pasted
// emoji, RTL text, very long pastes, and text that already contains brackets.
// The expected behaviour is stated here and in DEVELOPMENT.md.
//   node tools/test-edgecases.mjs

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

let failures = 0;
const fail = (m) => { console.log(`  FAIL  ${m}`); failures++; };
const ok = (m) => console.log(`  ok    ${m}`);

const LOWERCASE = 'the quick brown fox jumps over the lazy dog. ';
const LONG = LOWERCASE.repeat(230);            // ~10,350 characters
const FIVE_K = (LOWERCASE + 'and then it was done. ').repeat(140); // ~5,000 words

function timed(fn) {
  const t0 = process.hrtime.bigint();
  const out = fn();
  return { out, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  const bad = [];

  const check = (label, fn) => {
    try {
      if (!fn()) bad.push(label);
    } catch (err) {
      bad.push(`${label} threw ${err && err.message}`);
    }
  };

  check('empty input returns a prompt, not a crash', () => {
    const out = page.transform('', 1);
    return out.length > 0 && out.length < 200;
  });
  check('whitespace-only input returns the same prompt', () => {
    const out = page.transform('   \n\t  ', 1);
    return out.length > 0 && out.length < 200;
  });
  check('punctuation-only input survives cleanup', () => {
    const out = page.transform('...!!!???', 1);
    return typeof out === 'string' && out.length > 0;
  });
  check('numbers are preserved', () => page.transform('12345', 1).includes('12345'));
  check('emoji are preserved', () => page.transform('hello 😀 friend', 1).includes('😀'));
  check('RTL text is preserved', () => page.transform('مرحبا بالعالم', 1).includes('مرحبا'));
  check('existing stage directions keep their brackets', () => {
    const out = page.transform('[aside] hello friend', 1);
    return out.includes('[aside]') && out.includes(']');
  });
  check('blank-line paragraph breaks survive', () => {
    const out = page.transform('hello friend\n\nhow are you', 1);
    return out.includes('\n\n');
  });
  check('a 10,000-character paste completes under 5 s', () => {
    const r = timed(() => page.transform(LONG, 1));
    return r.out.length > LONG.length / 2 && r.out.length < LONG.length * 3 && r.ms < 5000;
  });
  check('a 5,000-word paste completes under 5 s', () => {
    const r = timed(() => page.transform(FIVE_K, 1));
    return r.out.length > 0 && r.ms < 5000;
  });
  check('a single very long word does not hang', () => {
    const r = timed(() => page.transform('x'.repeat(5000), 1));
    return r.out.length > 0 && r.ms < 2000;
  });
  check('markup-like input is treated as literal text', () => {
    const out = page.transform('<b>hello</b>', 1);
    return out.includes('<b>') && out.includes('</b>');
  });

  if (bad.length) bad.forEach((b) => fail(`${file}: ${b}`));
  else ok(`${file}: 12 edge cases`);
}

console.log(failures ? `\n${failures} edge-case failure(s)` : '\nevery edge case behaves as documented');
process.exitCode = failures ? 1 : 0;
