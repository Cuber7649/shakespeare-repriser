// Validates the generated manifest.json.
//
// manifest.json is produced by tools/build-icons.mjs, so nothing else in the
// suite would catch a broken field or a path pointing at a file that does not
// exist -- a bad icon path silently degrades installability rather than failing
// a test.
//
//   node tools/test-manifest.mjs

import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal decoder for the truecolour+alpha PNGs build-icons.mjs writes. Supports
// all five row filters so a future change to the painter cannot invalidate the
// checks silently.
function decodePng(buf) {
  if (buf.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG');
  let pos = 8;
  let w = 0, h = 0, depth = 0, colour = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      depth = data[8];
      colour = data[9];
    } else if (kind === 'IDAT') {
      idat.push(data);
    } else if (kind === 'IEND') {
      break;
    }
    pos += 12 + len;
  }
  if (depth !== 8 || colour !== 6) throw new Error(`unsupported PNG (depth ${depth}, colour ${colour})`);

  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const dst = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? dst[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) {
        throw new Error(`unsupported row filter ${filter}`);
      }
      dst[x] = v & 255;
    }
  }
  return { w, h, data: out };
}

function checkIcon(rel) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) return;
  let img;
  try {
    img = decodePng(readFileSync(file));
  } catch (e) {
    no(`${rel}: ${e.message}`);
    return;
  }

  const { w, h, data } = img;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const safe = 0.40 * Math.max(w, h) + 1;
  // The top-left pixel is the intended full-bleed background; comparing every
  // other pixel against it keeps the test independent of the palette.
  const bg = [data[0], data[1], data[2]];
  let transparent = 0;
  let content = 0;
  let outside = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (data[o + 3] !== 255) transparent++;
      const far = Math.abs(data[o] - bg[0]) > 8
        || Math.abs(data[o + 1] - bg[1]) > 8
        || Math.abs(data[o + 2] - bg[2]) > 8;
      if (far) {
        content++;
        if (Math.hypot(x - cx, y - cy) > safe) outside++;
      }
    }
  }

  const cornerBad = [[w - 1, 0], [0, h - 1], [w - 1, h - 1]].filter(([x, y]) => {
    const o = (y * w + x) * 4;
    return data[o + 3] !== 255
      || Math.abs(data[o] - bg[0]) > 8
      || Math.abs(data[o + 1] - bg[1]) > 8
      || Math.abs(data[o + 2] - bg[2]) > 8;
  }).length;

  if (transparent) {
    no(`${rel}: ${transparent} transparent pixel(s); Android masks expose the plate behind them`);
  } else {
    ok(`${rel}: fully opaque`);
  }
  if (cornerBad) {
    no(`${rel}: ${cornerBad} corner(s) differ from the top-left background`);
  } else {
    ok(`${rel}: background reaches every corner`);
  }
  if (!content) {
    no(`${rel}: no foreground art found above the background colour`);
  } else if (outside) {
    no(`${rel}: ${outside} foreground pixel(s) outside the maskable safe zone`);
  } else {
    ok(`${rel}: foreground art stays inside the maskable safe zone`);
  }
}

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

// --- launcher icons must be opaque and maskable-safe ---------------------------
// A transparent corner is composited over the launcher's white plate on
// Android, which is the bug this check exists to prevent. icon-180.png is not
// in the manifest but is the apple-touch icon, so it is checked too.
const iconFiles = [...new Set([
  'icon-180.png',
  ...m.icons.map((i) => i.src.replace(/^\.\//, '')),
])];
for (const rel of iconFiles) checkIcon(rel);

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
