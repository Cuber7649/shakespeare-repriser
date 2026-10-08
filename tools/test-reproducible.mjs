// The generated pages must rebuild byte-for-byte identically.
//
// This started as a scratch investigation and is kept because the failure it
// guards against is invisible: index.html and random.html copy dictionary text
// verbatim out of the style pages, so before this was added the output inherited
// whatever line endings the checkout happened to have. The committed random.html
// was pure CRLF while a rebuild produced a CRLF/LF mix, and index.html would have
// come out pure LF on CI. Browsers do not care, but it makes diffs unreadable and
// breaks the byte-level reproducibility the project relies on.
//
//   node tools/test-reproducible.mjs

import { readFileSync, existsSync, copyFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };

const GENERATED = [
  ['index.html', 'build-dashboard.mjs'],
];

// --- 1. no CR bytes at all in the generated output ---------------------------
for (const [file] of GENERATED) {
  const b = readFileSync(join(ROOT, file));
  const cr = (b.toString('utf8').match(/\r/g) || []).length;
  cr === 0
    ? ok(`${file} is pure LF (${b.length} bytes, 0 CR)`)
    : no(`${file} contains ${cr} CR byte(s); output is not EOL-normalised`);
}

// --- 2. rebuilding is a no-op -----------------------------------------------
const backup = [];
try {
  for (const [file] of GENERATED) {
    const tmp = join(ROOT, `.__repro-${file}`);
    copyFileSync(join(ROOT, file), tmp);
    backup.push([tmp, file]);
  }

  for (const [file, builder] of GENERATED) {
    const r = spawnSync(process.execPath, [join(ROOT, 'tools', builder)], { encoding: 'utf8' });
    if (r.status !== 0) { no(`${builder} failed: ${(r.stderr || '').trim()}`); continue; }
    const after = readFileSync(join(ROOT, file));
    const saved = readFileSync(join(ROOT, `.__repro-${file}`));
    after.equals(saved)
      ? ok(`rebuilding ${file} is a no-op (${after.length} bytes unchanged)`)
      : no(`${file} changed when rebuilt: ${saved.length} -> ${after.length} bytes`);
  }
} finally {
  for (const [tmp] of backup) if (existsSync(tmp)) unlinkSync(tmp);
}

console.log('');
console.log(failures ? `${failures} failure(s)` : 'generated output is reproducible');
process.exit(failures ? 1 : 0);
