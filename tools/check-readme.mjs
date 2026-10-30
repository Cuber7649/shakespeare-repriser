// Parses the two tables in README.md and checks each example against real
// output, so the docs cannot silently drift from behaviour.
//   node tools/check-readme.mjs
//   node tools/check-readme.mjs --write   # regenerate at the canonical seed
//
// The check accepts any corpus seed because output is randomised. `--write`
// pins the tables to SEED, which is what the committed README uses.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const README = join(ROOT, 'README.md');
const WRITE = process.argv.includes('--write');
const SEED = 2;

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

const clean = (s) => s.replace(/\s+/g, ' ').trim();
const run = (style, input, seed) => clean(pages[style].transform(input, seed));

let md = readFileSync(README, 'utf8');

// Rows of | `input` | Style | Output |
const rowRe = /^\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|\s*([^|]+?)\s*\|$/;
const styleRe = /^\|\s*`(\w+\.html)`\s*\|[^|]*\|\s*(.+?)\s*\|$/;
const pairRe = /"([^"]+)"\s*→\s*"([^"]*)"/g;

let rewritten = 0;
if (WRITE) {
  md = md.split(/\r?\n/).map((line) => {
    const row = line.match(rowRe);
    if (row) {
      const style = Object.keys(LABEL).find((k) => LABEL[k] === row[2]);
      if (!style) return line;
      const out = run(style, row[1], SEED);
      rewritten++;
      return `| \`${row[1]}\` | ${row[2]} | ${out} |`;
    }
    const styleRow = line.match(styleRe);
    if (styleRow) {
      const file = styleRow[1];
      const style = Object.keys(PAGES).find((k) => PAGES[k][0] === file);
      if (!style) return line;
      const cell = styleRow[2].replace(pairRe, (m, input, old) => {
        rewritten++;
        return `"${input}" → "${run(style, input, SEED)}"`;
      });
      return `| \`${file}\` | ${line.split('|')[2].trim()} | ${cell} |`;
    }
    return line;
  }).join('\n');
  writeFileSync(README, md);
  console.log(`wrote ${rewritten} example(s) to README.md at seed ${SEED}`);
}

// Rows of | `input` | Style | Output |
const rows = [];
for (const line of md.split(/\r?\n/)) {
  const m = line.match(rowRe);
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
  const hit = SEEDS.find((s) => run(r.style, r.input, s) === want);
  const ok = hit !== undefined;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${r.style.padEnd(11)} ${JSON.stringify(r.input)}`);
  console.log(`        README: ${JSON.stringify(want)}`);
  if (!ok) {
    console.log(`        actual (seed ${SEED}): ${JSON.stringify(run(r.style, r.input, SEED))}`);
    const sample = SEEDS.map((s) => run(r.style, r.input, s));
    console.log(`        all seeds: ${JSON.stringify([...new Set(sample)].slice(0, 3))}`);
  }
}

// Styles table: "input" -> "output" fragments
const styleRows = [];
for (const line of md.split(/\r?\n/)) {
  const m = line.match(styleRe);
  if (!m) continue;
  const style = Object.keys(PAGES).find((k) => PAGES[k][0] === m[1]);
  if (!style) continue;
  for (const pair of m[2].matchAll(pairRe)) {
    styleRows.push({ style, input: pair[1], output: pair[2] });
  }
}

console.log(`\nparsed ${styleRows.length} fragment example(s) from the Styles table\n`);
for (const r of styleRows) {
  const want = r.output.trim();
  const hit = SEEDS.find((s) => {
    const out = run(r.style, r.input, s);
    return out === want || out.toLowerCase() === want.toLowerCase();
  });
  const ok = hit !== undefined;
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${r.style.padEnd(11)} ${JSON.stringify(r.input)} -> ${JSON.stringify(want)}`);
  if (!ok) {
    const sample = SEEDS.map((s) => run(r.style, r.input, s));
    console.log(`        actual: ${JSON.stringify([...new Set(sample)].slice(0, 3))}`);
  }
}

console.log(bad ? `\n${bad} README example(s) do not match reality` : '\nevery README example matches real output');
process.exitCode = bad ? 1 : 0;
