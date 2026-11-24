// Static gate for the agent-facing surface: the llms.txt served by GitHub Pages,
// the stable browser hooks in all seven pages, and the window.Repriser block.
// Behaviour of the API itself is exercised in browser-journeys.mjs.
//
//   node tools/test-agent-surface.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ALL_PAGES, STYLE_IDS, DASHBOARD } from './styles.mjs';
import { browserSource } from './page-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };

// --- llms.txt ----------------------------------------------------------------
const llms = read('llms.txt');
for (const needle of [
  'https://cuber7649.github.io/shakespeare-repriser/',
  'window.Repriser', 'data-agent-action', 'Quote card',
  '#cardDownload', '#cardPreview', '#cardSkin', ...STYLE_IDS,
]) {
  llms.includes(needle) ? ok(`llms.txt documents ${needle}`) : no(`llms.txt is missing ${needle}`);
}

// --- the API block is pasted, and names no unseeded randomness ---------------
const block = browserSource(read('tools/sharelink.js'));
block.includes('window.Repriser = Repriser') && block.includes('function repAgentRun')
  ? ok('sharelink.js defines the window.Repriser API')
  : no('window.Repriser API missing from the shared block');
/Math\.random/.test(block)
  ? no('the agent API uses Math.random instead of the page seed')
  : ok('the agent API uses the seed field, not Math.random');
for (const page of ALL_PAGES) {
  read(page).includes(block) ? ok(`${page} carries the agent API block`)
    : no(`${page} agent API block has drifted`);
}

// --- stable hooks ------------------------------------------------------------
const GLOBAL_ACTIONS = ['transform', 'surprise', 'clear'];
const CARD_ACTIONS = ['copy', 'save', 'compare', 'card'];
// Count button tags, not raw text: the API block itself contains the
// transform selector as a string and would otherwise double the count.
const count = (src, action) =>
  (src.match(new RegExp(`<button[^>]*data-agent-action="${action}"`, 'g')) || []).length;

for (const page of ALL_PAGES) {
  const src = read(page);
  const expected = page === DASHBOARD ? STYLE_IDS.length : 1;
  let bad = 0;
  for (const action of GLOBAL_ACTIONS) {
    const hits = count(src, action);
    if (hits !== 1) { no(`${page}: ${hits} "${action}" actions, expected 1`); bad++; }
  }
  for (const action of CARD_ACTIONS) {
    const hits = count(src, action);
    if (hits !== expected) {
      no(`${page}: ${hits} "${action}" actions, expected ${expected}`);
      bad++;
    }
  }
  const ids = page === DASHBOARD
    ? ['go', 'dashSurprise', 'clear', ...STYLE_IDS.flatMap((id) =>
      [`cardBtn-${id}`, `copyBtn-${id}`, `saveBtn-${id}`, `compareBtn-${id}`])]
    : ['go', 'surpriseBtn', 'clearBtn', 'makeCardBtn', 'copyBtn', 'saveBtn', 'compareBtn'];
  const missing = ids.filter((id) => !src.includes(`id="${id}"`));
  if (missing.length) { no(`${page}: missing hook id(s) ${missing.join(', ')}`); bad++; }
  const outputs = page === DASHBOARD ? STYLE_IDS.map((id) => `id="out-${id}"`) : ['id="output"'];
  const missingOut = outputs.filter((id) => !src.includes(id));
  if (missingOut.length) { no(`${page}: missing output id(s) ${missingOut.join(', ')}`); bad++; }
  if (!src.includes('rel="alternate" type="text/plain" href="./llms.txt"')
    || !src.includes('<a href="./llms.txt">Agent guide</a>')) {
    no(`${page}: does not point agents at llms.txt`);
    bad++;
  }
  if (!bad) ok(`${page}: agent hooks, outputs and llms.txt discovery present`);
}

console.log('');
console.log(failures ? `${failures} agent-surface check(s) FAILED` : 'agent surface is ready');
process.exit(failures ? 1 : 0);
