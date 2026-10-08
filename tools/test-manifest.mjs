// Validates the generated manifest.json.
//
// manifest.json is produced by tools/build-icons.mjs, so nothing else in the
// suite would catch a broken field or a path pointing at a file that does not
// exist -- a bad icon path silently degrades installability rather than failing
// a test.
//
//   node tools/test-manifest.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };

const raw = readFileSync(join(ROOT, 'manifest.json'), 'utf8');

let m;
try {
  m = JSON.parse(raw);
  ok('manifest.json is valid JSON');
} catch (e) {
  no(`manifest.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

// --- required for installability ------------------------------------------------
for (const field of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
  m[field] === undefined ? no(`missing required field "${field}"`) : ok(`has "${field}"`);
}

// --- every referenced file must exist ------------------------------------------
const paths = [
  ...m.icons.map((i) => i.src),
  ...(m.shortcuts || []).flatMap((s) => (s.icons || []).map((i) => i.src)),
].map((p) => p.replace(/^\.\//, ''));

const missing = [...new Set(paths)].filter((p) => !existsSync(join(ROOT, p)));
if (missing.length) no(`referenced files not on disk: ${missing.join(', ')}`);
else ok(`all ${new Set(paths).size} referenced icon file(s) exist`);

// --- sizes must match the real images ------------------------------------------
for (const icon of m.icons) {
  const file = join(ROOT, icon.src.replace(/^\.\//, ''));
  if (!existsSync(file)) continue;
  const b = readFileSync(file);
  if (b.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') { no(`${icon.src} is not a PNG`); continue; }
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  const declared = icon.sizes.split('x').map(Number);
  if (w !== declared[0] || h !== declared[1]) {
    no(`${icon.src} is ${w}x${h} but declares ${icon.sizes}`);
  }
}
ok('declared icon sizes match the actual images');

// --- install criteria: needs a 192 and a 512, and a maskable icon ---------------
const sizes = m.icons.map((i) => i.sizes);
if (!sizes.includes('192x192')) no('no 192x192 icon (required for installability)');
if (!sizes.includes('512x512')) no('no 512x512 icon (required for installability)');
if (!m.icons.some((i) => (i.purpose || '').includes('maskable'))) {
  no('no maskable icon (required for Android install prompt)');
}
if (sizes.includes('192x192') && sizes.includes('512x512')
  && m.icons.some((i) => (i.purpose || '').includes('maskable'))) {
  ok('meets the Chrome installability criteria');
}

// --- every page the switcher offers should be reachable from the app ----------
const PAGES = ['index.html', 'shakespeare.html',
  'pirate.html', 'victorian.html', 'chaucer.html', 'yoda.html', 'norse.html'];
const pageMissing = PAGES.filter((p) => !existsSync(join(ROOT, p)));
pageMissing.length === 0
  ? ok(`all ${PAGES.length} pages present on disk`)
  : pageMissing.forEach((p) => no(`page missing: ${p}`));

// --- shortcuts must point at real pages, inside scope ---------------------------
if (m.shortcuts) {
  let bad = 0;
  for (const s of m.shortcuts) {
    for (const field of ['name', 'short_name', 'url']) {
      if (!s[field]) { no(`a shortcut is missing "${field}"`); bad++; }
    }
    const target = (s.url || '').replace(/^\.\//, '');
    if (!existsSync(join(ROOT, target))) { no(`shortcut "${s.short_name}" -> ${s.url} does not exist`); bad++; }
    if (!s.url.startsWith(m.scope)) { no(`shortcut "${s.short_name}" url is outside scope ${m.scope}`); bad++; }
    if (s.name && s.name.length > 40) { no(`shortcut name too long for a launcher menu: ${s.name}`); bad++; }
  }
  if (!bad) ok(`all ${m.shortcuts.length} shortcut(s) valid and in scope`);
} else {
  ok('no shortcuts declared (optional)');
}

// --- id pins identity, and must sit inside scope --------------------------------
if (m.id !== undefined) {
  if (!m.id.startsWith(m.scope)) no(`"id" is outside scope: ${m.id}`);
  else ok(`"id" pins identity at ${m.id}, inside scope`);
}

console.log('');
console.log(failures ? `${failures} failure(s)` : 'manifest is valid');
process.exit(failures ? 1 : 0);
