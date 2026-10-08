// Generates square app icons as real PNGs (no dependencies, zlib only) and
// writes manifest.json.
//
// The roadmap pointed manifest icons at Screenshot.png, which is a 630KB
// full-page screenshot: wrong aspect ratio, and "purpose": "any maskable"
// would crop it to a meaningless fragment.
//
//   node tools/build-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const BG = [0x2b, 0x2d, 0x42];
const GOLD = [0xd4, 0xa0, 0x56];
const PARCH = [0xf4, 0xe8, 0xcd];

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter: none
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Full-bleed dark background, a thin gold ring, and a centred gold lozenge
// with a cream shaft standing in for a quill. Maskable icons get cropped to a
// circle inscribed in the middle 80%, so all content stays within r <= 0.38.
function draw(size) {
  const img = Buffer.alloc(size * size * 3);
  const c = (size - 1) / 2;
  const ringInner = size * 0.335;
  const ringOuter = size * 0.375;
  const lozengeR = size * 0.27;
  const shaftHalf = size * 0.030;
  const nibR = size * 0.055;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      const diamond = Math.abs(dx) + Math.abs(dy);

      let col = BG;
      if (r >= ringInner && r <= ringOuter) col = GOLD;
      if (diamond <= lozengeR) col = GOLD;
      if (Math.abs(dx - dy) <= shaftHalf && diamond <= lozengeR) col = PARCH;
      if (Math.hypot(dx + size * 0.03, dy - size * 0.03) <= nibR) col = PARCH;

      const o = (y * size + x) * 3;
      img[o] = col[0];
      img[o + 1] = col[1];
      img[o + 2] = col[2];
    }
  }
  return img;
}

for (const size of [180, 192, 512]) {
  const buf = png(size, size, draw(size));
  writeFileSync(join(ROOT, `icon-${size}.png`), buf);
  console.log(`icon-${size}.png  ${(buf.length / 1024).toFixed(1)} KB`);
}

// manifest.json is generated here, so changes belong in this object, not in the
// output file -- editing manifest.json by hand is silently overwritten on the
// next run. tools/test-manifest.mjs checks the result.
//
// "id" pins the installed app's identity so it is not treated as a new app if
// start_url ever changes. There are no launcher "shortcuts": the six styles are
// reachable from the in-app switcher and would only clutter the OS menu.
const manifest = {
  name: 'Text Repriser Collection',
  short_name: 'Repriser',
  description:
    'Rewrite modern English into six historical and literary styles: Shakespeare, Pirate, Victorian, Chaucer, Yoda and Norse.',
  id: './index.html',
  start_url: './index.html',
  scope: './',
  display: 'standalone',
  orientation: 'any',
  background_color: '#2b2d42',
  theme_color: '#2b2d42',
  categories: ['entertainment', 'productivity', 'utilities'],
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest.json written');
