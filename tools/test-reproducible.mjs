// The generated files must rebuild byte-for-byte identically.
//
// This started as a scratch investigation and is kept because the failure it
// guards against is invisible: index.html copies dictionary text verbatim out
// of the style pages, so before this was added the output inherited whatever
// line endings the checkout happened to have. CI checked out pure LF while
// local builds could carry CRLF, and browsers do not care -- but the diffs
// become unreadable and byte-level reproducibility is a project invariant.
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

// Grouped by builder so each builder runs once, not once per output file.
const BUILDERS = [
  {
    builder: 'build-dashboard.mjs',
    files: ['index.html'],
  },
  {
    builder: 'build-icons.mjs',
    files: [
      'manifest.json',
      'icon-180.png', 'icon-192.png', 'icon-512.png',
      'icon-round-192.png', 'icon-round-512.png',
    ],
  },
];
const GENERATED = BUILDERS.flatMap(({ builder, files }) =>
  files.map((file) => [file, builder]));

// --- 1. no CR bytes in text output -------------------------------------------
for (const [file] of GENERATED) {
  if (!/\.(html|json)$/.test(file)) continue;
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

  for (const { builder, files } of BUILDERS) {
    const r = spawnSync(process.execPath, [join(ROOT, 'tools', builder)], { encoding: 'utf8' });
    if (r.status !== 0) { no(`${builder} failed: ${(r.stderr || '').trim()}`); continue; }
    for (const file of files) {
      const after = readFileSync(join(ROOT, file));
      const saved = readFileSync(join(ROOT, `.__repro-${file}`));
      after.equals(saved)
        ? ok(`rebuilding ${file} is a no-op (${after.length} bytes unchanged)`)
        : no(`${file} changed when rebuilt: ${saved.length} -> ${after.length} bytes`);
    }
  }
} finally {
  for (const [tmp] of backup) if (existsSync(tmp)) unlinkSync(tmp);
}

console.log('');
console.log(failures ? `${failures} failure(s)` : 'generated output is reproducible');
process.exit(failures ? 1 : 0);
