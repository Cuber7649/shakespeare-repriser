// Every local link on every page must resolve to a file that exists.
//
// Nothing else in the suite checks this. A nav link to a page that was renamed,
// or a manifest path with a typo, degrades quietly: the page still renders and
// every other test still passes, because link rot is a 404 at runtime, not a
// build error. Worth having now that the switcher has nine entries.
//
//   node tools/test-links.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };

const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

// Everything reachable from a nav or manifest, and that it must all exist for.
const EXPECTED_TARGETS = new Set([
  'index.html',
  'shakespeare.html', 'pirate.html', 'victorian.html',
  'chaucer.html', 'yoda.html', 'norse.html',
  'icon-192.png', 'icon-512.png', 'icon-180.png', 'manifest.json',
]);

// --- 1. every local href/src in every page ----------------------------------
let checked = 0;
const broken = [];
for (const file of pages) {
  const html = readFileSync(join(ROOT, file), 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|data:|mailto:|#)/.test(url)) continue;   // not a local file
    const target = url.replace(/^\.\//, '').split('#')[0].split('?')[0];
    if (!target) continue;
    checked++;
    if (!existsSync(join(ROOT, target))) {
      broken.push(`${file} -> ${url}`);
    }
  }
}
broken.length === 0
  ? ok(`all ${checked} local link(s) across ${pages.length} pages resolve`)
  : broken.forEach((b) => no(`broken link: ${b}`));

// --- 2. the switcher is identical on every page ----------------------------
// If these drift, a page is silently missing from the nav, which no other test
// would notice because every individual link is still valid. The active marker
// is excluded here and checked separately below, since it must differ per page.
const links = (h) => {
  const m = /<div class="style-switcher">([\s\S]*?)<\/div>/.exec(h);
  if (!m) return null;
  return [...m[1].matchAll(/<a href="\.\/([^"]+)"/g)].map((a) => a[1]).join('|');
};
const activeOn = (h) => {
  const m = /<div class="style-switcher">([\s\S]*?)<\/div>/.exec(h);
  if (!m) return [];
  return [...m[1].matchAll(/<a href="\.\/([^"]+)"[^>]*class="active"/g)].map((a) => a[1]);
};

const switchers = new Map();
for (const file of pages) {
  const s = links(readFileSync(join(ROOT, file), 'utf8'));
  if (s === null) continue;
  if (!switchers.has(s)) switchers.set(s, []);
  switchers.get(s).push(file);
}
if (switchers.size === 1) {
  const [sig, files] = [...switchers.entries()][0];
  ok(`all ${files.length} pages share one switcher (${sig.split('|').length} entries)`);
} else {
  for (const [sig, files] of switchers) {
    no(`switcher differs on: ${files.join(', ')}\n         ${sig}`);
  }
}

// Every page must mark exactly one link active, and it must be itself.
let badActive = 0;
for (const file of pages) {
  const on = activeOn(readFileSync(join(ROOT, file), 'utf8'));
  if (on.length !== 1 || on[0] !== file) {
    no(`${file} marks active: ${on.length ? on.join(', ') : 'nothing'} (expected itself)`);
    badActive++;
  }
}
if (!badActive) ok(`every page marks exactly itself active (${pages.length}/${pages.length})`);

// --- 3. manifest paths and the shared HTML targets exist --------------------
const manifestPaths = [
  manifest.start_url,
  ...manifest.icons.map((i) => i.src),
  ...(manifest.shortcuts || []).map((s) => s.url),
].map((p) => p.replace(/^\.\//, ''));

const mMissing = [...new Set(manifestPaths)].filter((p) => !existsSync(join(ROOT, p)));
mMissing.length === 0
  ? ok(`all ${new Set(manifestPaths).size} manifest path(s) resolve`)
  : mMissing.forEach((p) => no(`manifest path not on disk: ${p}`));

const expectMissing = [...EXPECTED_TARGETS].filter((p) => !existsSync(join(ROOT, p)));
expectMissing.length === 0
  ? ok(`all ${EXPECTED_TARGETS.size} expected site file(s) present`)
  : expectMissing.forEach((p) => no(`expected file missing: ${p}`));

console.log('');
console.log(failures ? `${failures} failure(s)` : 'every link resolves');
process.exit(failures ? 1 : 0);
