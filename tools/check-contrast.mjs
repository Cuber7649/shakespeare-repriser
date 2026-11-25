// Static WCAG AA gate for the shared stylesheets and the dashboard stylesheet.
// Every text colour in those blocks is paired with its real background: each
// gradient stop is tested separately, and translucent fills (including hover
// fills and the input's white wash) are alpha-blended over the stop beneath.
// Body text needs 4.5:1; text at or above 24px needs 3:1.
//
//   node tools/check-contrast.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseColor, blend, contrastRatio } from './contrast.mjs';
import { STYLE_FILES } from './styles.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const SOURCES = [
  'tools/savedquotes.css',
  'tools/options.css',
  'tools/card-modal.css',
  'tools/compare.css',
  'tools/build-dashboard.mjs', // DASH_CSS only
];

// Opaque backgrounds of the containing surfaces. A gradient contributes all of
// its stops; the worst stop decides, which is the conservative choice.
const FAMILY_BG = {
  'saved-quotes': ['#fffcf5', '#f8f0de', '#f2e8ce'],
  'options-panel': ['#fdf6e3', '#f6ecd2', '#efe0bc'],
  'modal-box': ['#fdf6e3', '#f4e8cd'],
  cmp: ['#fffcf5', '#f8f0de', '#f2e8ce'],
  mini: ['#fdf6e3', '#f4e8cd'],
};

// Translucent layers that sit between a family surface and its text even when
// the text's own rule declares no background.
const FAMILY_OVERLAY = {
  cmp: ['rgba(255,252,245,0.75)'],
};
const EXTRA_OVERLAY = {
  'saved-quotes-field': ['rgba(255,255,255,0.65)'],
};

const FAMILY_OF = [
  [/^saved-quotes/, 'saved-quotes'],
  [/^options-/, 'options-panel'],
  [/^(modal-|cardModal)/, 'modal-box'],
  [/^cmp-/, 'cmp'],
  [/^(mini|out)/, 'mini'],
];

function dashCss(src) {
  const marker = 'const DASH_CSS = `';
  const start = src.indexOf(marker);
  if (start < 0) throw new Error('DASH_CSS not found in tools/build-dashboard.mjs');
  const end = src.indexOf('`;', start);
  if (end < 0) throw new Error('unterminated DASH_CSS');
  return src.slice(start + marker.length, end);
}

// Flatten @media nesting into plain selector/declaration pairs. The shared
// blocks use simple one-level rules, so this stays a scanner rather than a
// full CSS parser; nested animation overrides simply carry no colour.
function rulesFrom(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const selector = m[1].trim().split('\n').pop().trim();
    if (!selector || selector.startsWith('@') || selector.startsWith('}')) continue;
    const decls = {};
    for (const part of m[2].split(';')) {
      const i = part.indexOf(':');
      if (i > 0) decls[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
    }
    out.push({ selector, decls });
  }
  return out;
}

function firstColor(value) {
  const m = /(#[0-9a-f]{3,6}|rgba?\([^)]*\))/i.exec(String(value || ''));
  return m ? parseColor(m[1]) : null;
}

function fontPx(decls) {
  const m = /([\d.]+)\s*(rem|em|px)/.exec(decls['font-size'] || '');
  if (!m) return 16;
  return m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16;
}

let failures = 0;
let checked = 0;

for (const file of SOURCES) {
  const css = file.endsWith('.mjs') ? dashCss(read(file)) : read(file);
  for (const rule of rulesFrom(css)) {
    if (!rule.decls.color) continue;
    const fg = parseColor(rule.decls.color);
    if (!fg) continue; // inherit, currentColor, etc.
    const token = rule.selector.replace(/^[.#]/, '').split(/[\s:>,.[]/)[0];
    const family = (FAMILY_OF.find(([re]) => re.test(token)) || [null, null])[1];
    if (!family) continue; // colour on a surface we do not model here

    const overlays = [];
    for (const c of FAMILY_OVERLAY[family] || []) overlays.push(parseColor(c));
    if (EXTRA_OVERLAY[token] && !rule.decls.background) {
      for (const c of EXTRA_OVERLAY[token]) overlays.push(parseColor(c));
    }
    const own = firstColor(rule.decls.background || rule.decls['background-color']);
    if (own) overlays.push(own);

    let worst = Infinity;
    for (const baseStop of FAMILY_BG[family]) {
      let bg = parseColor(baseStop);
      for (const layer of overlays) bg = blend(layer, bg);
      worst = Math.min(worst, contrastRatio(fg, bg));
    }
    const need = fontPx(rule.decls) >= 24 ? 3 : 4.5;
    checked++;
    if (worst + 1e-9 < need) {
      console.log(`FAIL  ${file}: "${rule.selector}" colour ${rule.decls.color} is ${worst.toFixed(2)}:1, need ${need}`);
      failures++;
    }
  }
}

// The active navigation pill is hand-written in each style page (the dashboard
// inherits it from shakespeare.html). It sits on the dark body with a
// translucent gold wash; the old dark-on-brown pair measured only 1.41:1.
for (const file of STYLE_FILES) {
  const m = /\.style-switcher a\.active\s*\{([^}]*)\}/.exec(read(file));
  const bgRaw = m && /(?:^|;)\s*background:\s*([^;]+);/m.exec(m[1]);
  const fgRaw = m && /(?:^|;)\s*color:\s*([^;]+);/m.exec(m[1]);
  if (!bgRaw || !fgRaw) {
    console.log(`FAIL  ${file}: could not read the active navigation colours`);
    failures++;
    continue;
  }
  const bg = blend(parseColor(bgRaw[1]), parseColor('#1a1209'));
  const ratio = contrastRatio(fgRaw[1], bg);
  if (ratio + 1e-9 < 4.5) {
    console.log(`FAIL  ${file}: active navigation is ${ratio.toFixed(2)}:1, need 4.5`);
    failures++;
  } else {
    console.log(`  ok    ${file}: active navigation pill is ${ratio.toFixed(2)}:1`);
  }
}

// Quick-sample chips are hand-written in each style page and sit on the same
// dark body with a faint parchment wash.
for (const file of STYLE_FILES) {
  const m = /\.surprise-sample\s*\{([^}]*)\}/.exec(read(file));
  const bgRaw = m && /(?:^|;)\s*background:\s*([^;]+);/m.exec(m[1]);
  const fgRaw = m && /(?:^|;)\s*color:\s*([^;]+);/m.exec(m[1]);
  if (!bgRaw || !fgRaw) {
    console.log(`FAIL  ${file}: could not read the quick-sample chip colours`);
    failures++;
    continue;
  }
  const bg = blend(parseColor(bgRaw[1]), parseColor('#1a1209'));
  const ratio = contrastRatio(fgRaw[1], bg);
  if (ratio + 1e-9 < 4.5) {
    console.log(`FAIL  ${file}: quick-sample chip is ${ratio.toFixed(2)}:1, need 4.5`);
    failures++;
  } else {
    console.log(`  ok    ${file}: quick-sample chip is ${ratio.toFixed(2)}:1`);
  }
}

if (failures) {
  console.log(`\n${failures} contrast failure(s) across ${checked} text colour rules`);
  process.exitCode = 1;
} else {
  console.log(`ok    ${checked} text colour rules meet WCAG AA against their backgrounds`);
}
