// Shared source-extraction helpers for the two generators.
//
// tools/build-dashboard.mjs and tools/build-random.mjs both need to lift
// declarations and functions out of the hand-written style pages verbatim. When
// the same ~70 lines of bracket-and-string-aware scanner exists twice it will
// drift, so it lives here once.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const html = (root, file) => readFileSync(join(root, file), 'utf8');

export function scriptOf(src) {
  const blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]).filter((s) => s.trim());
  return blocks[blocks.length - 1];
}

// Extract `const|let|var NAME = ...;` verbatim, bracket- and string-aware so
// regex literals and inline arrow functions survive intact.
export function extractDecl(src, name) {
  const start = src.search(new RegExp(`^(?:const|let|var) ${name}\\s*=`, 'm'));
  if (start < 0) throw new Error(`declaration of ${name} not found`);
  let i = src.indexOf('=', start) + 1;
  while (/\s/.test(src[i])) i++;
  const open = src[i];
  const close = { '[': ']', '{': '}' }[open];
  if (!close) {
    // Simple scalar initialiser such as `const _randomSeed = Math.random;`
    const end = src.indexOf(';', i);
    if (end < 0) throw new Error(`unterminated declaration of ${name}`);
    return src.slice(start, end + 1);
  }

  let depth = 0, quote = null, inRe = false, inLine = false, inBlock = false;
  for (; i < src.length; i++) {
    const c = src[i], p = src[i - 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '/' && p === '*') inBlock = false; continue; }
    if (quote) { if (c === quote && p !== '\\') quote = null; continue; }
    if (inRe) { if (c === '/' && p !== '\\') inRe = false; continue; }
    if (c === '/' && src[i + 1] === '/') { inLine = true; continue; }
    if (c === '/' && src[i + 1] === '*') { inBlock = true; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && /[=(,:[!&|?{};+\-*%~^]/.test(src[i - 1] || ' ')) { inRe = true; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(start, src.indexOf(';', i) + 1);
  }
  throw new Error(`unterminated const ${name}`);
}

// Extract a whole `function name(...) { ... }` declaration verbatim.
export function extractFunction(src, name) {
  const start = src.search(new RegExp(`^function ${name}\\s*\\(`, 'm'));
  if (start < 0) throw new Error(`function ${name} not found`);
  let i = src.indexOf('{', start);
  let depth = 0, quote = null, inRe = false, inLine = false, inBlock = false;
  for (; i < src.length; i++) {
    const c = src[i], p = src[i - 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '/' && p === '*') inBlock = false; continue; }
    if (quote) { if (c === quote && p !== '\\') quote = null; continue; }
    if (inRe) { if (c === '/' && p !== '\\') inRe = false; continue; }
    if (c === '/' && src[i + 1] === '/') { inLine = true; continue; }
    if (c === '/' && src[i + 1] === '*') { inBlock = true; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && /[=(,:[!&|?{};+\-*%~^]/.test(p || ' ')) { inRe = true; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

export function between(src, fromRe, toRe, what) {
  const a = src.search(fromRe);
  if (a < 0) throw new Error(`start marker for ${what} not found: ${fromRe}`);
  const rest = src.slice(a);
  const m = rest.slice(1).search(toRe);
  if (m < 0) throw new Error(`end marker for ${what} not found: ${toRe}`);
  const block = rest.slice(0, m + 1);
  if (!block.trim()) throw new Error(`empty extraction for ${what}`);
  return block;
}

// Strip the CommonJS tail and any BOM so a browser-inlinable source remains.
export function browserSource(src) {
  return src
    .replace(/^\uFEFF/, '')
    .replace(/\n?if \(typeof module[\s\S]*$/m, '');
}

// Remove a media query and its block. The style pages each carry a
// prefers-reduced-motion block; a generated page inherits that base CSS and adds
// its own, and check-css.mjs requires exactly one per file.
export function stripMediaQuery(css, query) {
  const re = new RegExp(`@media\\s*${query.replace(/[()]/g, (m) => '\\' + m)}`, 'i');
  const at = css.search(re);
  if (at < 0) return css;
  let i = css.indexOf('{', at);
  let depth = 0;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) break;
  }
  return css.slice(0, at) + css.slice(i + 1);
}
