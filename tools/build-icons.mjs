// Generates square app icons as real PNGs (no dependencies, zlib only), the
// matching scalable icon.svg favicon, and manifest.json.
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
const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

// Icon geometry as fractions of the canvas, shared by the PNG painter below
// and the SVG writer so the two renditions cannot drift apart. The dark disc
// is round with a transparent background; ring, lozenge and shaft stay inside
// the maskable safe zone (radius 0.40) so cropped launch icons lose nothing.
const GEO = {
  disc: 0.47,
  ringInner: 0.335,
  ringOuter: 0.375,
  lozenge: 0.27,
  shaftHalf: 0.03,
  nibR: 0.055,
  nibDx: -0.03,
  nibDy: 0.03,
};

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

function png(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // colour type: truecolour + alpha (the disc floats on transparent corners)
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// A round dark disc (antialiased edge, transparent outside), a thin gold ring
// and a centred gold lozenge with a cream shaft standing in for a quill.
// Maskable icons get cropped to a circle inscribed in the middle 80%, so all
// content stays within r <= 0.38.
function draw(size) {
  const img = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const discR = size * GEO.disc;
  const ringInner = size * GEO.ringInner;
  const ringOuter = size * GEO.ringOuter;
  const lozengeR = size * GEO.lozenge;
  const shaftHalf = size * GEO.shaftHalf;
  const nibR = size * GEO.nibR;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const r = Math.hypot(dx, dy);
      const diamond = Math.abs(dx) + Math.abs(dy);

      let col = null;
      const cover = Math.max(0, Math.min(1, discR - r + 0.5));
      if (cover > 0) col = [BG[0], BG[1], BG[2], Math.round(cover * 255)];
      if (r >= ringInner && r <= ringOuter) col = [GOLD[0], GOLD[1], GOLD[2], 255];
      if (diamond <= lozengeR) col = [GOLD[0], GOLD[1], GOLD[2], 255];
      if (Math.abs(dx - dy) <= shaftHalf && diamond <= lozengeR) col = [PARCH[0], PARCH[1], PARCH[2], 255];
      if (Math.hypot(dx - size * GEO.nibDx, dy - size * GEO.nibDy) <= nibR) col = [PARCH[0], PARCH[1], PARCH[2], 255];

      const o = (y * size + x) * 4;
      if (col) {
        img[o] = col[0];
        img[o + 1] = col[1];
        img[o + 2] = col[2];
        img[o + 3] = col[3];
      }
    }
  }
  return img;
}

// The same picture as vector text: crisp as a favicon at any density, while
// install and home-screen icons stay raster PNG. The band condition
// |dx - dy| <= shaftHalf is a stroke of perpendicular width shaftHalf * sqrt(2)
// running between the two opposite lozenge edges.
function svgSource(size = 512) {
  const r2 = (n) => Math.round(n * 100) / 100;
  const c = size / 2;
  const loz = size * GEO.lozenge;
  const end = loz / 2;
  const ringR = size * (GEO.ringInner + GEO.ringOuter) / 2;
  const ringW = size * (GEO.ringOuter - GEO.ringInner);
  const shaftW = size * GEO.shaftHalf * Math.SQRT2;
  const nibX = c + size * GEO.nibDx;
  const nibY = c + size * GEO.nibDy;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <circle cx="${r2(c)}" cy="${r2(c)}" r="${r2(size * GEO.disc)}" fill="${hex(BG)}"/>
  <circle cx="${r2(c)}" cy="${r2(c)}" r="${r2(ringR)}" fill="none" stroke="${hex(GOLD)}" stroke-width="${r2(ringW)}"/>
  <polygon points="${r2(c)},${r2(c - loz)} ${r2(c + loz)},${r2(c)} ${r2(c)},${r2(c + loz)} ${r2(c - loz)},${r2(c)}" fill="${hex(GOLD)}"/>
  <line x1="${r2(c - end)}" y1="${r2(c - end)}" x2="${r2(c + end)}" y2="${r2(c + end)}" stroke="${hex(PARCH)}" stroke-width="${r2(shaftW)}"/>
  <circle cx="${r2(nibX)}" cy="${r2(nibY)}" r="${r2(size * GEO.nibR)}" fill="${hex(PARCH)}"/>
</svg>
`;
}

for (const size of [180, 192, 512]) {
  const buf = png(size, size, draw(size));
  writeFileSync(join(ROOT, `icon-${size}.png`), buf);
  console.log(`icon-${size}.png  ${(buf.length / 1024).toFixed(1)} KB`);
}

const svg = svgSource(512);
writeFileSync(join(ROOT, 'icon.svg'), svg);
console.log(`icon.svg         ${(svg.length / 1024).toFixed(1)} KB`);

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
