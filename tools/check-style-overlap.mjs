// Vocabulary-overlap report plus a README uniqueness gate.
//
// The six styles share a lot of ordinary English on purpose ("the", "is",
// "friend"), so raw overlap is reported, not failed. What must not happen is
// two styles producing the same line for the same documented example: that
// makes the README look like a copy-paste error and hides a style's voice.
//   node tools/check-style-overlap.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEED = 2;

const PAGES = {
  shakespeare: ['shakespeare.html', 'shakespearify'],
  pirate: ['pirate.html', 'pirateify'],
  victorian: ['victorian.html', 'victorianify'],
  chaucer: ['chaucer.html', 'chaucerify'],
  yoda: ['yoda.html', 'yodaify'],
  norse: ['norse.html', 'norseify'],
};
const TABLES = ['commonWords', 'verbs', 'adjectives', 'nouns'];
const LABEL = {
  shakespeare: 'Shakespeare', pirate: 'Pirate', victorian: 'Victorian',
  chaucer: 'Chaucer', yoda: 'Yoda', norse: 'Norse',
};

let failures = 0;
const fail = (m) => { console.log(`FAIL  ${m}`); failures++; };
const ok = (m) => console.log(`ok    ${m}`);

// Same bracket scanner as test-content.mjs: the arrays contain regex literals,
// so a naive regex would stop at the first `]` inside a character class.
function arraysFrom(file, names) {
  const s = readFileSync(join(ROOT, file), 'utf8');
  const out = {};
  for (const n of names) {
    const i = s.indexOf(`const ${n} = [`);
    if (i < 0) throw new Error(`${n} not found in ${file}`);
    let depth = 0;
    const open = s.indexOf('[', i);
    let j = open;
    for (; j < s.length; j++) {
      if (s[j] === '[') depth++;
      else if (s[j] === ']') { depth--; if (!depth) break; }
    }
    out[n] = eval(s.slice(open, j + 1));
  }
  return out;
}

console.log('replacement values shared between styles (informational)\n');
const values = {};
for (const [style, [file]] of Object.entries(PAGES)) {
  values[style] = new Set();
  const tables = arraysFrom(file, TABLES);
  for (const table of TABLES) {
    for (const [, rep] of tables[table]) {
      if (typeof rep === 'string') values[style].add(rep.toLowerCase());
    }
  }
}

for (const style of Object.keys(PAGES)) {
  const shared = [...values[style]].filter((v) =>
    Object.keys(PAGES).some((other) => other !== style && values[other].has(v)));
  const pct = values[style].size ? (100 * shared.length / values[style].size) : 0;
  console.log(`  ${LABEL[style].padEnd(11)} ${String(values[style].size).padStart(4)} values, `
    + `${String(shared.length).padStart(4)} also used elsewhere (${pct.toFixed(0)}%)`);
  if (!values[style].size) fail(`${style}: no replacement values at all`);
  if (values[style].size && shared.length === values[style].size) {
    fail(`${style}: every replacement value is shared with another style; it has no voice of its own`);
  }
}

const common = [...new Set(Object.values(values).flatMap((s) => [...s]))]
  .map((v) => [v, Object.keys(PAGES).filter((p) => values[p].has(v)).length])
  .filter(([, n]) => n > 1)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, 8);
console.log(`\n  most widely shared: ${common.map(([v, n]) => `${JSON.stringify(v)} x${n}`).join(', ')}`);

// --- README input documented in more than one style --------------------------
// Two styles may share ordinary vocabulary; what must not happen is the README
// documenting the same input for two styles and getting the same line back.
const md = readFileSync(join(ROOT, 'README.md'), 'utf8');
const byInput = new Map();
function add(style, input) {
  if (!byInput.has(input)) byInput.set(input, new Set());
  byInput.get(input).add(style);
}
for (const line of md.split(/\r?\n/)) {
  const row = line.match(/^\|\s*`([^`]+)`\s*\|\s*(\w+)\s*\|/);
  if (row) {
    const style = Object.keys(LABEL).find((k) => LABEL[k] === row[2]);
    if (style) add(style, row[1]);
  }
  const frag = line.match(/^\|\s*`\w+\.html`\s*\|[^|]*\|\s*(.+?)\s*\|$/);
  if (frag) {
    for (const m of frag[1].matchAll(/"([^"]+)"\s*→/g)) {
      const file = line.match(/`(\w+\.html)`/)[1];
      const style = Object.keys(PAGES).find((k) => PAGES[k][0] === file);
      if (style) add(style, m[1]);
    }
  }
}

console.log('\nREADME inputs documented for more than one style (seed 2)\n');
const pages = {};
for (const [style, [file, entry]] of Object.entries(PAGES)) {
  pages[style] = loadPage(join(ROOT, file), entry);
}

let compared = 0;
for (const [input, styles] of byInput) {
  if (styles.size < 2) continue;
  compared++;
  const outs = [...styles].map((style) => ({
    style,
    out: pages[style].transform(input, SEED).replace(/\s+/g, ' ').trim(),
  }));
  const byOutput = new Map();
  for (const { style, out } of outs) {
    if (!byOutput.has(out)) byOutput.set(out, []);
    byOutput.get(out).push(style);
  }
  for (const [out, same] of byOutput) {
    if (same.length > 1) {
      fail(`${JSON.stringify(input)} is identical in ${same.map((s) => LABEL[s]).join(' and ')}: ${JSON.stringify(out)}`);
    }
  }
  console.log(`  ${JSON.stringify(input)}`);
  for (const { style, out } of outs) console.log(`    ${LABEL[style].padEnd(11)} ${JSON.stringify(out)}`);
}
if (!compared) ok('no README input is documented for more than one style');

console.log(failures ? `\n${failures} style-overlap problem(s)` : '\nno style produces another style\'s README line');
process.exitCode = failures ? 1 : 0;
