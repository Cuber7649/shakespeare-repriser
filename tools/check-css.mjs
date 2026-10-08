// Validates the inline <style> block of every page: balanced braces, the
// reduced-motion query present exactly once, and real <label for> wiring. The
// Node harness only parses <script>, so CSS errors slip past it.
//   node tools/check-css.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

for (const file of readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(join(ROOT, file), 'utf8');
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
  const problems = [];

  let depth = 0;
  let minDepth = 0;
  for (const ch of style) {
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth < minDepth) minDepth = depth;
    }
  }
  if (depth !== 0) problems.push(`unbalanced braces (net ${depth})`);
  if (minDepth < 0) problems.push('closing brace with no opener');

  const rm = (style.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/g) || []).length;
  if (rm !== 1) problems.push(`prefers-reduced-motion query count = ${rm}, expected 1`);

  // The style pages mark the output region live; the dashboard uses a single
  // role="status" region instead, so accept either.
  const live = (html.match(/aria-live="polite"/g) || []).length;
  const status = (html.match(/role="status"/g) || []).length;
  if (live + status < 1) problems.push('no aria-live or role="status" region');

  // Every form control must have a real <label for> pointing at a real id. The
  // transform pages have one textarea; random.html has two selects, so the count
  // is not fixed -- what matters is that the labels exist and are wired up.
  const labels = [...html.matchAll(/<label class="card-label" for="([^"]+)"/g)].map((m) => m[1]);
  if (labels.length < 1) problems.push('no <label class="card-label" for=...>');
  for (const target of labels) {
    if (!html.includes(`id="${target}"`)) {
      problems.push(`<label for="${target}"> has no matching id`);
    }
  }
  // A page with a textarea must still label it exactly once.
  if (html.includes('id="input"') && !labels.includes('input')) {
    problems.push('textarea #input has no <label for="input">');
  }

  if (/&#9998;<\/span> Modern English<\/div>/.test(html)) {
    problems.push('input label still a <div>');
  }

  if (problems.length) failures++;
  console.log(
    `${file.padEnd(20)} ${problems.length ? 'FAIL  ' + problems.join('; ') : 'ok'}`
  );
}

console.log(`\n${failures ? failures + ' file(s) failed' : 'all files ok'}`);
process.exitCode = failures ? 1 : 0;
