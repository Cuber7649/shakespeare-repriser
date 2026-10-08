// Parses the two tables in README.md and checks each example against real
// output, so the docs cannot silently drift from behaviour.
//   node tools/check-readme.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(ROOT, 'README.md'), 'utf8');

const PAGES = {
  shakespeare: ['shakespeare.html', 'shakespearify'],
  pirate: ['pirate.html', 'pirateify'],
  victorian: ['victorian.html', 'victorianify'],
  chaucer: ['chaucer.html', 'chaucerify'],
  yoda: ['yoda.html', 'yodaify'],
  norse: ['norse.html', 'norseify'],
};

const pages = {};
for (const [k, [f, e]] of Object.entries(PAGES)) pages[k] = loadPage(join(ROOT, f), e);

const LABEL = {
  shakespeare: 'Shakespeare', pirate: 'Pirate', victorian: 'Victorian',
  chaucer: 'Chaucer', yoda: 'Yoda', norse: 'Norse',
};

// Rows of | `input` | Style | Output |
const rows = [];
for (const line of md.split(/\r?\n/)) {
  const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*([^|]+?)\s*\|$/);
  if (!m) continue;
  const style = Object.keys(LABEL).find((k) => LABEL[k] === m[2]);
  if (style) rows.push({ input: m[1], style, output: m[3] });
}

console.log(`\nparsed ${rows.length} example row(s) from README.md\n`);
let bad = 0;

// The README shows one representative run, so accept the quoted output if it
// appears for ANY seed. That is the honest contract for randomised output.
for (const r of rows) {
  const want = r.output.replace(/^["']|["']$/g, '').trim();
  const hit = SEEDS.find((s) => {
    const out = pages[r.style].transform(r.input, s).replace(/\s+/g, ' ').trim();
    return out === want;
  });
  const ok = hit !== undefined;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${r.style.padEnd(11)} ${JSON.stringify(r.input)}`);
  console.log(`        README: ${JSON.stringify(want)}`);
  if (!ok) {
    console.log(`        actual (seed 2): ${JSON.stringify(pages[r.style].transform(r.input, 2).replace(/\s+/g, ' ').trim())}`);
    const sample = SEEDS.map((s) => pages[r.style].transform(r.input, s).replace(/\s+/g, ' ').trim());
    console.log(`        all seeds: ${JSON.stringify([...new Set(sample)].slice(0, 3))}`);
  }
}

// Styles table: "input" -> "output" fragments
const styleRows = [];
for (const line of md.split(/\r?\n/)) {
  const m = line.match(/^\|\s*`(\w+\.html)`\s*\|[^|]*\|\s*(.+?)\s*\|$/);
  if (!m) continue;
  const file = m[1];
  const style = Object.keys(PAGES).find((k) => PAGES[k][0] === file);
  if (!style) continue;
  for (const pair of m[2].matchAll(/"([^"]+)"\s*→\s*"([^"]+)"/g)) {
    styleRows.push({ style, input: pair[1], output: pair[2] });
  }
}

console.log(`\nparsed ${styleRows.length} fragment example(s) from the Styles table\n`);
for (const r of styleRows) {
  const want = r.output.trim();
  const hit = SEEDS.find((s) => {
    const out = pages[r.style].transform(r.input, s).replace(/\s+/g, ' ').trim();
    return out === want || out.toLowerCase() === want.toLowerCase();
  });
  const ok = hit !== undefined;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${r.style.padEnd(11)} ${JSON.stringify(r.input)} -> ${JSON.stringify(want)}`);
  if (!ok) {
    const sample = SEEDS.map((s) => pages[r.style].transform(r.input, s).replace(/\s+/g, ' ').trim());
    console.log(`        actual: ${JSON.stringify([...new Set(sample)].slice(0, 3))}`);
  }
}

console.log(bad ? `\n${bad} README example(s) do not match reality` : '\nevery README example matches real output');
process.exitCode = bad ? 1 : 0;
