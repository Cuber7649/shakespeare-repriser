// One-off: add the missing leading \b to yoda.html rules so they stop matching
// inside longer words (grandchild -> Grandyoung one). Reports before/after.
//   node tools/fix-yoda-wordbound.mjs [--apply]

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(ROOT, 'yoda.html');
const apply = process.argv.includes('--apply');

const src = readFileSync(target, 'utf8');

// `[/` always opens a rule literal. Add \b only where one is not already there.
const before = (src.match(/\[\//g) || []).length;
const already = (src.match(/\[\/\\b/g) || []).length;
const out = src.replace(/\[\/(?![\\])/g, '[/\\b');
const after = (out.match(/\[\/\\b/g) || []).length;

console.log(`rule literals:        ${before}`);
console.log(`already had \\b:      ${already}`);
console.log(`will now have \\b:    ${after}`);
console.log(`rules fixed:          ${after - already}`);

if (!apply) {
  console.log('\ndry run - pass --apply to write');
} else {
  writeFileSync(target, out);
  console.log('\nyoda.html written');
}
