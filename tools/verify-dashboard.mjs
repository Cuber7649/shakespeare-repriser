// Verifies the generated dashboard modules behave identically to the six
// style pages: same dictionaries, same output for the same input and seed.
//   node tools/verify-dashboard.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { loadPage } from './harness.mjs';
import { CORPUS, SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STYLES = [
  { id: 'shakespeare', file: 'shakespeare.html', entry: 'shakespearify' },
  { id: 'pirate', file: 'pirate.html', entry: 'pirateify' },
  { id: 'victorian', file: 'victorian.html', entry: 'victorianify' },
  { id: 'chaucer', file: 'chaucer.html', entry: 'chaucerify' },
  { id: 'yoda', file: 'yoda.html', entry: 'yodaify' },
  { id: 'norse', file: 'norse.html', entry: 'norseify' },
];

const src = readFileSync(join(ROOT, 'tools', '.dashboard-modules.js'), 'utf8');
const sandbox = { STYLES: {}, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: '.dashboard-modules.js' });

let failures = 0;
let checked = 0;
let mismatch = 0;

for (const { id, file, entry } of STYLES) {
  const mod = sandbox.STYLES[id];
  if (!mod) {
    console.log(`${id}: MISSING from modules`);
    failures++;
    continue;
  }
  const page = loadPage(join(ROOT, file), entry);

  let local = 0;
  for (const input of CORPUS) {
    for (const seed of SEEDS) {
      const expected = page.transform(input, seed);
      const got = mod.transform(input, seed);
      checked++;
      if (expected !== got) {
        local++;
        if (mismatch < 6) {
          console.log(`\nMISMATCH ${file} seed ${seed} input ${JSON.stringify(input)}`);
          console.log(`  page      : ${JSON.stringify(expected)}`);
          console.log(`  dashboard : ${JSON.stringify(got)}`);
        }
        mismatch++;
      }
    }
  }
  if (local) {
    console.log(`${id}: ${local} mismatch(es)`);
    failures++;
  } else {
    console.log(`${id}: identical to ${file} across ${CORPUS.length * SEEDS.length} cases`);
  }
}

console.log(`\nbehaviour: ${checked - mismatch}/${checked} identical`);
console.log(failures ? `${failures} style(s) FAILED` : 'all styles match the pages');
process.exitCode = failures ? 1 : 0;
