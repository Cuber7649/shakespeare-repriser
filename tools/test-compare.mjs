// The can't-drift gate for the original/output comparison view.
//
// The pages are standalone, so tools/compare.js and tools/compare.css are
// pasted into all seven of them by hand. This test is what makes that safe:
// the pasted blocks must still match this file byte for byte, the markup the
// blocks reach for must exist, and the diff itself must behave -- ordinary
// replacements, insertions, deletions, reordered text, paragraph breaks,
// punctuation-only changes, the low-similarity fallback, and escaping.
//   node tools/test-compare.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { browserSource } from './page-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STYLE_PAGES = ['shakespeare.html', 'pirate.html', 'victorian.html',
  'chaucer.html', 'yoda.html', 'norse.html'];
const PAGES = [...STYLE_PAGES, 'index.html'];

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };
const section = (t) => console.log(`\n${t}`);

const norm = (s) => s.replace(/\r\n/g, '\n').trimEnd();
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const block = norm(browserSource(read('tools/compare.js')));
const css = norm(read('tools/compare.css'));

// --- 1. the pasted copies have not drifted ----------------------------------
section('verbatim copies');
for (const file of PAGES) {
  const page = norm(read(file));
  if (!page.includes(block)) no(`${file}: compare.js block has drifted`);
}
const blockPages = PAGES.filter((f) => norm(read(f)).includes(block));
if (blockPages.length === PAGES.length) ok(`JS block identical in all ${PAGES.length} files`);

for (const file of PAGES) {
  const page = norm(read(file));
  if (!page.includes(css)) no(`${file}: compare.css block has drifted`);
}
const cssPages = PAGES.filter((f) => norm(read(f)).includes(css));
if (cssPages.length === PAGES.length) ok(`CSS block identical in all ${PAGES.length} files`);

// --- 2. the markup the block reaches for exists -----------------------------
section('markup');
let btnBad = 0;
for (const file of STYLE_PAGES) {
  if (!read(file).includes('data-compare="output"')) { no(`${file}: no Compare button`); btnBad++; }
}
const dash = read('index.html');
const ids = ['shakespeare', 'pirate', 'victorian', 'chaucer', 'yoda', 'norse'];
const dashMissing = ids.filter((id) => !dash.includes(`data-compare="out-${id}"`));
if (dashMissing.length) { no(`index.html: no Compare button for ${dashMissing.join(', ')}`); btnBad++; }
if (!btnBad) ok('one Compare button per output on the dashboard and every style page');

// --- 3. the diff itself -----------------------------------------------------
section('diff behaviour (shakespeare.html)');
const page = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
const compare = page.api.compareTexts;
const render = page.api.renderCompare;

if (!compare || !render) {
  no('compareTexts/renderCompare not exposed by the page script');
} else {
  // Ordinary replacement: shared words align, changed words are marked.
  const rep = compare('the king is very happy today', 'the king is right pleased this day');
  const repP = rep.paragraphs[0];
  if (rep.stats.fellBack) no('replacement fell back unexpectedly');
  else if (repP.mode !== 'aligned') no(`replacement mode = ${repP.mode}`);
  else if (!repP.left.some((t) => t.t === 'del' && t.w === 'happy')) {
    no(`replacement: "happy" not marked deleted: ${JSON.stringify(repP.left)}`);
  } else if (!repP.right.some((t) => t.t === 'ins' && t.w === 'pleased')) {
    no(`replacement: "pleased" not marked inserted: ${JSON.stringify(repP.right)}`);
  } else if (!repP.left.some((t) => t.t === 'eq' && t.w === 'king')) {
    no('replacement: "king" not aligned as equal');
  } else ok('ordinary replacement aligns shared words, marks the rest');

  // Insertion: new words appear only on the right, marked ins.
  const ins = compare('you are my friend', 'Hark! You art my true friend, forsooth.');
  const insP = ins.paragraphs[0];
  if (ins.stats.added < 2) no(`insertion: added = ${ins.stats.added}`);
  else if (ins.stats.removed > 2) no(`insertion: removed = ${ins.stats.removed}, expected at most 2`);
  else if (!insP.right.some((t) => t.t === 'ins' && t.w === 'Hark!')) {
    no('insertion: "Hark!" not marked inserted');
  } else ok('insertion marks added words on the output side only');

  // Deletion: dropped words appear only on the left, marked del.
  const del = compare('Hark! You art my good friend indeed, forsooth.', 'You art my friend.');
  const delP = del.paragraphs[0];
  if (del.stats.removed < 2) no(`deletion: removed = ${del.stats.removed}`);
  else if (!delP.left.some((t) => t.t === 'del' && t.w === 'Hark!')) {
    no('deletion: "Hark!" not marked deleted');
  } else if (delP.right.some((t) => t.t === 'ins')) {
    no('deletion: right side has spurious insertions');
  } else ok('deletion marks removed words on the original side only');

  // Reordered text (Yoda fronting): enough words survive that alignment is
  // still the honest view -- the move shows as del+ins, not a fallback.
  const reo = compare('you are my friend', 'My friend, you are.');
  const reoP = reo.paragraphs[0];
  if (reo.stats.fellBack) no('reordered short sentence fell back unexpectedly');
  else if (reoP.mode !== 'aligned') no(`reordered mode = ${reoP.mode}`);
  else if (!reoP.right.some((t) => t.t === 'ins' && t.w === 'My')) {
    no('reordered: fronted "My" not marked inserted');
  } else ok('reordered text stays aligned; the move shows as del+ins');

  // Punctuation-only changes must not be highlighted.
  const pun = compare('Hello, world!', 'Hello world');
  if (pun.stats.added || pun.stats.removed) {
    no(`punctuation-only: added=${pun.stats.added} removed=${pun.stats.removed}`);
  } else ok('punctuation-only change marks nothing');

  // Paragraph breaks survive on both sides.
  const par = compare('first para here\n\nsecond para here',
    'first para transformed\n\nsecond para transformed');
  if (par.paragraphs.length !== 2) no(`paragraphs: ${par.paragraphs.length} paragraph(s), expected 2`);
  else {
    const html = render('first para here\n\nsecond para here',
      'first para transformed\n\nsecond para transformed');
    const leftParas = (html.match(/cmp-para/g) || []).length;
    // 2 paragraphs x 2 sides = 4 cmp-para occurrences.
    if (leftParas !== 4) no(`paragraphs: ${leftParas} cmp-para blocks in HTML, expected 4`);
    else ok('paragraph breaks preserved as separate blocks on both sides');
  }

  // Low similarity falls back to a plain, readable view with a note.
  const far = compare('the quick brown fox jumps',
    'methinks the sky doth weep upon the frozen hills of winter sorrow');
  if (!far.stats.fellBack) no('unrelated text did not fall back');
  else if (far.paragraphs[0].mode !== 'fallback') no(`fallback mode = ${far.paragraphs[0].mode}`);
  else if (far.paragraphs[0].left.some((t) => t.t === 'del' || t.t === 'ins')) {
    no('fallback paragraph still has word marks');
  } else if (!render('the quick brown fox jumps',
    'methinks the sky doth weep upon the frozen hills of winter sorrow').includes('shown plain')) {
    no('fallback render has no explanatory note');
  } else ok('low-similarity text falls back to plain columns with a note');

  // One-sided paragraphs (text added or removed wholesale) stay marked.
  const one = compare('keep me', 'keep me\n\nbrand new paragraph entirely');
  if (one.paragraphs.length !== 2) no(`one-sided: ${one.paragraphs.length} paragraph(s), expected 2`);
  else if (!one.paragraphs[1].right.every((t) => t.t === 'ins')) {
    no('one-sided: added paragraph is not fully marked inserted');
  } else ok('a wholly added paragraph is marked inserted, not treated as fallback');

  // HTML in either side is escaped before it reaches innerHTML.
  const html = render('<script>alert(1)</script> is bad', '<script>alert(1)</script> is most foul');
  if (html.includes('<script>')) no('render emitted a raw <script> tag');
  else if (!html.includes('&lt;script&gt;')) no('render did not escape the script tag');
  else ok('HTML in the compared text is escaped');

  // The empty-state messages the toggle shows before there is anything to diff.
  const emptyOrig = page.api.cmpEmptyMessage('', 'something');
  const emptyOut = page.api.cmpEmptyMessage('something', '');
  if (!/enter some text/i.test(emptyOrig || '')) no(`empty original message: ${JSON.stringify(emptyOrig)}`);
  else if (!/transform some text/i.test(emptyOut || '')) no(`empty output message: ${JSON.stringify(emptyOut)}`);
  else ok('empty input and empty output each get their own guidance');

  // The toggle: a button click fills a panel and flips aria-expanded.
  const btn = page.document.getElementById('compareBtnTest');
  btn.setAttribute('data-compare', 'output');
  page.document.getElementById('input').value = 'the king is very happy today';
  page.document.getElementById('output').textContent = 'the king is right pleased this day';
  const opened = page.api.cmpToggle(btn);
  const panel = page.document.getElementById('cmp-panel-output');
  if (!opened) no('cmpToggle did not open the panel');
  else if (panel.hidden) no('panel is still hidden after opening');
  else if (btn.getAttribute('aria-expanded') !== 'true') no('aria-expanded not set to true');
  else if (!panel.innerHTML.includes('<del>')) no('panel HTML has no diff marks');
  else ok('toggle opens the panel, fills it with the diff, sets aria-expanded');

  const closed = page.api.cmpToggle(btn);
  if (closed !== false || !panel.hidden) no('second click did not close the panel');
  else if (btn.getAttribute('aria-expanded') !== 'false') no('aria-expanded not reset to false');
  else ok('second click closes the panel and resets aria-expanded');
}

console.log('');
console.log(failures ? `${failures} check(s) FAILED` : 'all compare checks passed');
process.exitCode = failures ? 1 : 0;
