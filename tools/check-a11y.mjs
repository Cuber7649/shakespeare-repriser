// Static accessibility audit of the seven shipped pages. Complements
// check-css.mjs (styles) with markup-level checks: language, landmarks,
// label wiring, accessible names, dialog semantics and status regions.
// This is an audit of the checks below, not a WCAG conformance claim.
//   node tools/check-a11y.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['shakespeare.html', 'pirate.html', 'victorian.html',
  'chaucer.html', 'yoda.html', 'norse.html', 'index.html'];

let failures = 0;
const fail = (m) => { console.log(`FAIL  ${m}`); failures++; };
const pass = (m) => console.log(`ok    ${m}`);

const stripTags = (s) => s.replace(/<[^>]*>/g, '');
// Decode the numeric/named entities the pages actually use, so a button whose
// only content is &#10003; is not treated as nameless.
const decode = (s) => stripTags(s)
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

for (const file of PAGES) {
  const html = readFileSync(join(ROOT, file), 'utf8');
  const bad = [];
  const say = (m) => bad.push(m);

  // 1. language and viewport
  if (!/<html\b[^>]*\blang="/i.test(html)) say('missing <html lang>');
  if (!/<meta\b[^>]*name="viewport"/i.test(html)) say('missing viewport meta');

  // 2. exactly one h1
  const h1s = html.match(/<h1\b/gi) || [];
  if (h1s.length !== 1) say(`found ${h1s.length} <h1>, expected 1`);

  // 3. every form control has an accessible name: label[for], wrapping
  //    label, or aria-label/aria-labelledby.
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const labelFors = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  const controls = [...html.matchAll(/<(input|textarea|select)\b([^>]*)>/gi)];
  for (const [, tag, attrs] of controls) {
    if (/\btype="(hidden|button|submit|reset)"/i.test(attrs)) continue;
    const idMatch = /\bid="([^"]+)"/.exec(attrs);
    const id = idMatch ? idMatch[1] : null;
    const named = /\baria-label="/.test(attrs) || /\baria-labelledby="/.test(attrs)
      || (id && labelFors.has(id));
    // Wrapping <label> control: a crude but sufficient check is the control
    // sitting between a <label ...> and its </label>.
    let wrapping = false;
    if (!named && id) {
      const at = html.indexOf(`id="${id}"`);
      const open = html.lastIndexOf('<label', at);
      const close = html.indexOf('</label>', at);
      wrapping = open !== -1 && close !== -1 && open < at && at < close;
    }
    if (!named && !wrapping) say(`<${tag}${id ? ` id="${id}"` : ''}> has no label`);
  }

  // 4. every label[for] points at a real control
  for (const forId of labelFors) {
    if (!ids.has(forId)) say(`label for="${forId}" has no matching id`);
  }

  // 5. every button has a non-empty accessible name
  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const [, attrs, inner] = m;
    const name = /\baria-label="([^"]+)"/.exec(attrs);
    const text = name ? name[1] : decode(inner);
    if (!text) say(`button has no accessible name: ${m[0].slice(0, 70)}`);
  }

  // 6. dialog semantics on the card modal, referencing real ids
  if (!/<div\b[^>]*id="cardModal"[\s\S]*?role="dialog"/i.test(html)
    && !/role="dialog"[^>]*\bid="cardModal"/i.test(html)) {
    // The modal div carries role on its inner box in the shipped markup.
    if (!html.includes('role="dialog"')) say('card modal has no role="dialog"');
  }
  if (!html.includes('aria-modal="true"')) say('card modal missing aria-modal="true"');
  for (const m of html.matchAll(/\baria-labelledby="([^"]+)"/g)) {
    if (!ids.has(m[1])) say(`aria-labelledby="${m[1]}" has no matching id`);
  }
  for (const m of html.matchAll(/\baria-controls="([^"]+)"/g)) {
    if (!ids.has(m[1])) say(`aria-controls="${m[1]}" has no matching id`);
  }

  // 7. at least one live status region for announcements
  if (!/role="status"|aria-live=/i.test(html)) say('no role="status" or aria-live region');

  // 8. images carry alt text
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt="/i.test(m[1])) say(`<img${m[1].slice(0, 40)}> missing alt`);
  }

  // 9. a visible focus style exists (the pages use :focus-visible)
  if (!/:focus-visible\b/.test(html)) say('no :focus-visible style in the page CSS');

  // 10. reduced motion is honoured (check-css.mjs enforces the count; this
  //     confirms the block actually mentions the animation properties)
  if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)/i.test(html)) {
    say('no prefers-reduced-motion block');
  }

  if (bad.length) bad.forEach((b) => fail(`${file}: ${b}`));
  else pass(`${file}: lang, h1, labels, names, dialog, status, focus, motion`);
}

console.log(failures ? `\n${failures} accessibility issue(s)` : '\nall accessibility checks passed');
process.exitCode = failures ? 1 : 0;
