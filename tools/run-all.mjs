// Runs the whole suite in order. Any non-zero exit fails the run.
//   node tools/run-all.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const STEPS = [
  ['build-dashboard', ['build-dashboard.mjs']],
  ['build-icons', ['build-icons.mjs']],
  // Screenshot.png is deliberately NOT built here. It is maintained by hand from
  // a real browser, and tools/build-screenshot.mjs is an opt-in helper for
  // regenerating it on request. Running it as part of the suite would silently
  // overwrite the committed image every time.
  ['check-css', ['check-css.mjs']],
  ['check-readme', ['check-readme.mjs']],
  ['readme-features', ['readme-features.mjs']],
  ['test-engine', ['test-engine.mjs']],
  ['test-transform', ['test-transform.mjs']],
  ['test-quotecard', ['test-quotecard.mjs']],
  ['test-cardpages', ['test-cardpages.mjs']],
  ['test-savedquotes', ['test-savedquotes.mjs']],
  ['test-manifest', ['test-manifest.mjs']],
  ['test-content', ['test-content.mjs']],
  ['test-yoda', ['test-yoda.mjs']],
  ['test-settings', ['test-settings.mjs']],
  ['test-reproducible', ['test-reproducible.mjs']],
  ['test-links', ['test-links.mjs']],
  ['verify-dashboard', ['verify-dashboard.mjs']],
  ['smoke-dashboard', ['smoke-dashboard.mjs', '1']],
  ['smoke-dashboard', ['smoke-dashboard.mjs', '2']],
  ['smoke-dashboard', ['smoke-dashboard.mjs', '3']],
];

let failed = 0;
for (const [name, args] of STEPS) {
  const r = spawnSync(process.execPath, args.map((a) => join(HERE, a)), {
    encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const bad = r.status !== 0;
  if (bad) failed++;
  const tail = out.trim().split(/\r?\n/).filter(Boolean).pop() || '(no output)';
  console.log(`${bad ? 'FAIL' : 'ok  '}  ${name.padEnd(18)} ${tail}`);
  if (bad) {
    console.log(out.trim().split(/\r?\n/).map((l) => `        ${l}`).join('\n'));
  }
}

console.log('');
console.log(failed ? `${failed} step(s) failed` : 'all steps passed');
process.exit(failed ? 1 : 0);
