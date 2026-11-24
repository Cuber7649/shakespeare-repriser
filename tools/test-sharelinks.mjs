// Shareable-link gate: the snippet is pasted into all seven pages, the payload
// round-trips (including the text cap), and the fragment stays client-side.
//   node tools/test-sharelinks.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { browserSource } from './page-source.mjs';
import { ALL_PAGES } from './styles.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const norm = (s) => s.replace(/\r\n/g, '\n');

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };

const block = norm(browserSource(read('tools/sharelink.js'))).trimEnd();

console.log('\npasted copies');
for (const page of ALL_PAGES) {
  norm(read(page)).includes(block)
    ? ok(`${page}: share-link block in sync`)
    : no(`${page}: share-link block missing or drifted`);
}

console.log('\nbutton and privacy');
for (const [needle, label] of [
  ["btn.setAttribute('data-share', style)", 'button carries its style'],
  ['Copy Link', 'accessible button text'],
  ['&#128279;', 'pictogram as an HTML entity'],
  ['aria-hidden="true"', 'decorative icon span hidden from AT'],
]) {
  block.includes(needle) ? ok(label) : no(`missing ${label}`);
}
if (!/\b(fetch\s*\(|XMLHttpRequest|\.send\s*\()/.test(block)) {
  ok('fragment is never sent to a server');
} else no('share-link block makes a network request');
block.includes('location.hash') || block.includes('history.replaceState')
  ? ok('writes only the fragment/history')
  : no('does not write to the URL fragment');

console.log('\npayload');
const ctx = {
  console, Math, JSON, Number, String, isFinite,
  encodeURIComponent, decodeURIComponent,
};
vm.createContext(ctx);
vm.runInContext(`${block}\n;globalThis.api = { shareEncode, shareDecode, SHARE_MAX_TEXT };`, ctx);
const { shareEncode, shareDecode, SHARE_MAX_TEXT } = ctx.api;

const opts = {
  intensity: 'dramatic', openings: false, metaphors: true,
  asides: false, invert: true, seed: 1337,
};
const fragment = shareEncode('Hello, world! & more', 'pirate', opts);
const decoded = shareDecode('#' + fragment);
if (fragment.startsWith('share=1&style=pirate&i=2&f=') && fragment.includes('&text=')) {
  ok(`readable fragment: ${JSON.stringify('#' + fragment)}`);
} else no(`fragment is not human-readable: ${JSON.stringify('#' + fragment)}`);
if (!decoded) {
  no('round trip returned nothing');
} else {
  decoded.text === 'Hello, world! & more'
    && decoded.style === 'pirate'
    && JSON.stringify(decoded.opts) === JSON.stringify(opts)
    ? ok('round trip preserves text, style, settings and seed')
    : no(`round trip changed the payload: ${JSON.stringify(decoded)}`);
}

// optSeedValue() only accepts whole integers, so a fractional seed in a link
// must be dropped here rather than advertised and silently lost on apply.
const fractional = shareDecode('#share=1&style=pirate&i=2&f=15&d=1.5&text=hi');
!fractional || fractional.opts.seed === null
  ? ok('rejects a fractional seed')
  : no(`accepted a fractional seed: ${JSON.stringify(fractional.opts)}`);

const capped = shareDecode('#' + shareEncode('x'.repeat(5000), 'yoda', opts));
capped && capped.text.length === SHARE_MAX_TEXT
  ? ok(`text capped at ${SHARE_MAX_TEXT} characters`)
  : no(`text not capped (got ${capped && capped.text.length})`);

for (const bad of ['', '#share=', '#other=1',
  '#share=1&text=%ZZ',
  '#share=1&f=oops&d=&text=x',
  '#share=2&i=0&f=15&d=&text=x',
  '#share=1&text=' + encodeURIComponent('x'.repeat(5000))]) {
  shareDecode(bad) === null
    ? ok(`rejects malformed hash ${JSON.stringify(bad)}`)
    : no(`accepted malformed hash ${JSON.stringify(bad)}`);
}

console.log(failures ? `\n${failures} share-link check(s) failed`
  : 'share links are wired into all seven pages');
process.exit(failures ? 1 : 0);
