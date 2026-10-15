// The can't-drift gate for the quote card on the six style pages.
//
// The pages are standalone, so tools/quotecard.js, tools/cardui.js and
// tools/cardpage.js are pasted into all six of them by hand, exactly like the
// saved-quotes block. This test is what makes that safe: the pasted blocks must
// still match their sources byte for byte, the markup the wiring reaches for
// must exist, and a click through the page's own listener must open the modal
// with the page's own style.
//   node tools/test-cardpages.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { browserSource } from './page-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STYLES = {
  'shakespeare.html': 'shakespeare',
  'pirate.html': 'pirate',
  'victorian.html': 'victorian',
  'chaucer.html': 'chaucer',
  'yoda.html': 'yoda',
  'norse.html': 'norse',
};
const PAGES = Object.keys(STYLES);
const MODAL_IDS = ['cardModal', 'cardPreview', 'cardModalNote', 'cardModalWarn',
  'cardStatus', 'cardClose', 'cardDownload',
  'cardSkin', 'cardBackground', 'cardAlign', 'cardOriginal'];

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };
const section = (t) => console.log(`\n${t}`);

const norm = (s) => s.replace(/\r\n/g, '\n').trimEnd();
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const blocks = [
  ['quotecard.js', norm(browserSource(read('tools/quotecard.js')))],
  ['cardui.js', norm(browserSource(read('tools/cardui.js')))],
  ['cardpage.js', norm(browserSource(read('tools/cardpage.js')))],
  ['card-modal.css', norm(read('tools/card-modal.css'))],
  ['card-modal.html', norm(read('tools/card-modal.html'))],
];

// --- 1. the pasted copies have not drifted ---------------------------------
section('verbatim copies');
for (const [label, block] of blocks) {
  const bad = PAGES.filter((f) => !norm(read(f)).includes(block));
  bad.forEach((f) => no(`${f}: ${label} block has drifted`));
  if (!bad.length) ok(`${label} identical in all ${PAGES.length} style pages`);
}
const dash = norm(read('index.html'));
for (const [label, block] of blocks.filter(([label]) => label !== 'cardpage.js')) {
  if (!dash.includes(block)) no(`index.html: ${label} block missing`);
}
if (blocks.filter(([l]) => l !== 'cardpage.js').every(([, b]) => dash.includes(b))) {
  ok('dashboard still carries quotecard, cardui and both modal fragments');
}

// --- 2. the markup the wiring reaches for exists ---------------------------
section('markup');
let markupBad = 0;
for (const file of PAGES) {
  const page = read(file);
  const missing = MODAL_IDS.filter((id) => !page.includes(`id="${id}"`));
  if (missing.length) { no(`${file}: missing id(s) ${missing.join(', ')}`); markupBad++; }
  if (!page.includes('id="makeCardBtn"')) { no(`${file}: missing #makeCardBtn`); markupBad++; }
  if (!page.includes(`data-card="${STYLES[file]}"`)) { no(`${file}: wrong data-card`); markupBad++; }
  if (!/Make Card/.test(page)) { no(`${file}: no Make Card button text`); markupBad++; }
  if (!page.includes('#cardModal .modal-box')) {
    no(`${file}: modal not covered by prefers-reduced-motion`);
    markupBad++;
  }
  // Every page already animates .card/.output-card with cardIn, so the modal's
  // own keyframes have to be named differently or one of them silently wins.
  const shared = (page.match(/@keyframes cardIn\b/g) || []).length;
  if (shared !== 1) { no(`${file}: @keyframes cardIn count = ${shared}, expected 1`); markupBad++; }
}
if (!markupBad) ok(`modal ids, button, data-card and reduced-motion ok in all ${PAGES.length} pages`);

let dashBad = 0;
const dashCards = (dash.match(/data-card="/g) || []).length;
if (dashCards !== PAGES.length) { no(`index.html: ${dashCards} data-card buttons, expected ${PAGES.length}`); dashBad++; }
if ((dash.match(/id="cardModal"/g) || []).length !== 1) { no('index.html: #cardModal not unique'); dashBad++; }
if (!dashBad) ok(`dashboard: ${dashCards} Make Card buttons, one modal`);

// --- 3. behaviour through the page's own listeners -------------------------
section('behaviour (shakespeare.html)');
const page = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
const btn = page.document.getElementById('makeCardBtn');
const modal = page.document.getElementById('cardModal');
const note = page.document.getElementById('cardModalNote');
const status = page.document.getElementById('cardStatus');
const out = page.document.getElementById('output');

if (!page.api.cardPage) no('cardPage was not initialised by the page script');
else if (!page.api.CARD_THEMES || !page.api.CARD_THEMES.shakespeare) no('CARD_THEMES missing from the page');
else ok('wiring ran on load with the page theme available');

if (modal.hidden !== true) no(`modal starts ${JSON.stringify(modal.hidden)}, expected hidden`);
else ok('modal starts hidden');

out.textContent = '';
const openedEmpty = page.fire(btn, 'click');
if (!openedEmpty) no('Make Card button has no click listener');
else if (status.textContent !== 'Transform some text first') no(`empty output said ${JSON.stringify(status.textContent)}`);
else if (modal.hidden !== true) no('empty output opened the modal anyway');
else ok('empty output -> message, modal stays closed');

out.textContent = 'Hail, good morrow, friend';
page.fire(btn, 'click');
if (modal.hidden !== false) no('click did not open the modal');
else if (note.textContent !== 'Drawing a shakespeare card') no(`note = ${JSON.stringify(note.textContent)}`);
else ok('click -> modal opens, drawn for this style');

page.api.cardPageUI.close();
if (modal.hidden !== true) no('close() left the modal open');
else ok('close() -> modal hidden again');

section('behaviour (yoda.html)');
const yoda = loadPage(join(ROOT, 'yoda.html'), 'yodaify');
const yodaBtn = yoda.document.getElementById('makeCardBtn');
const yodaModal = yoda.document.getElementById('cardModal');
const yodaNote = yoda.document.getElementById('cardModalNote');
yoda.document.getElementById('output').textContent = 'Pie, I like';
yoda.fire(yodaBtn, 'click');
if (yodaModal.hidden !== false) no('yoda: click did not open the modal');
else if (yodaNote.textContent !== 'Drawing a yoda card') no(`yoda: note = ${JSON.stringify(yodaNote.textContent)}`);
else ok('yoda: modal opens for its own style');

console.log('');
console.log(failures ? `${failures} check(s) FAILED` : 'all quote-card page checks passed');
process.exitCode = failures ? 1 : 0;
