// Performance and page-size budget. The numbers are deliberately generous:
// this is a tripwire for an accidental quadratic loop or a runaway dictionary,
// not a benchmark. Raise a budget only after looking at what grew.
//   node tools/test-budgets.mjs

import { statSync } from 'node:fs';
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

const STYLE_BUDGET = 220 * 1024;   // current largest is yoda.html at ~188 KB
const DASH_BUDGET = 520 * 1024;    // current dashboard is ~432 KB
const SHORT_MS = 2000;
const LONG_MS = 5000;

const LOWERCASE = 'the quick brown fox jumps over the lazy dog. ';
const SHORT = LOWERCASE.repeat(12);   // ~108 words
const LONG = LOWERCASE.repeat(560);   // ~5,040 words

let failures = 0;
const fail = (m) => { console.log(`  FAIL  ${m}`); failures++; };
const ok = (m) => console.log(`  ok    ${m}`);

console.log('transform timings\n');
for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  const t0 = process.hrtime.bigint();
  const short = page.transform(SHORT, 1);
  const shortMs = Number(process.hrtime.bigint() - t0) / 1e6;
  const t1 = process.hrtime.bigint();
  const long = page.transform(LONG, 1);
  const longMs = Number(process.hrtime.bigint() - t1) / 1e6;

  const shortOk = short.length > 0 && shortMs < SHORT_MS;
  const longOk = long.length > 0 && longMs < LONG_MS;
  console.log(`  ${shortOk && longOk ? 'ok  ' : 'FAIL'}  ${file.padEnd(18)} `
    + `${shortMs.toFixed(0).padStart(4)} ms / 100 words   ${longMs.toFixed(0).padStart(5)} ms / 5,000 words`);
  if (!shortOk) fail(`${file}: 100-word transform took ${shortMs.toFixed(0)} ms (budget ${SHORT_MS})`);
  if (!longOk) fail(`${file}: 5,000-word transform took ${longMs.toFixed(0)} ms (budget ${LONG_MS})`);
}

console.log('\npage sizes\n');
for (const [file] of PAGES) {
  const bytes = statSync(join(ROOT, file)).size;
  const within = bytes <= STYLE_BUDGET;
  console.log(`  ${within ? 'ok  ' : 'FAIL'}  ${file.padEnd(18)} ${(bytes / 1024).toFixed(0).padStart(4)} KB (budget ${STYLE_BUDGET / 1024} KB)`);
  if (!within) fail(`${file}: ${(bytes / 1024).toFixed(0)} KB exceeds the ${STYLE_BUDGET / 1024} KB budget`);
}
{
  const bytes = statSync(join(ROOT, 'index.html')).size;
  const within = bytes <= DASH_BUDGET;
  console.log(`  ${within ? 'ok  ' : 'FAIL'}  ${'index.html'.padEnd(18)} ${(bytes / 1024).toFixed(0).padStart(4)} KB (budget ${DASH_BUDGET / 1024} KB)`);
  if (!within) fail(`index.html: ${(bytes / 1024).toFixed(0)} KB exceeds the ${DASH_BUDGET / 1024} KB budget`);
}

console.log(failures ? `\n${failures} budget failure(s)` : '\nwithin the performance and size budgets');
process.exitCode = failures ? 1 : 0;
