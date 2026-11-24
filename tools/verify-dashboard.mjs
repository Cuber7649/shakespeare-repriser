// Verifies the generated dashboard modules behave identically to the six
// style pages: same dictionaries, same output for the same input and seed.
//   node tools/verify-dashboard.mjs

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { loadPage } from './harness.mjs';
import { CORPUS, SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

import { ID_FILE_ENTRY as STYLES } from './styles.mjs';

// The module dump is a gitignored build intermediate. On a fresh clone it does
// not exist yet, so build it rather than throwing ENOENT.
const modulesPath = join(ROOT, 'tools', '.dashboard-modules.js');
if (!existsSync(modulesPath)) {
  const build = spawnSync(process.execPath, [join(ROOT, 'tools', 'build-dashboard.mjs')],
    { encoding: 'utf8' });
  if (build.status !== 0) {
    console.error('Could not build tools/.dashboard-modules.js -- run npm run build first.');
    process.exit(1);
  }
}
const src = readFileSync(modulesPath, 'utf8');
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
