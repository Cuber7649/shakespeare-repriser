// The can't-drift gate for saved quotes.
//
// The pages are standalone, so tools/savedquotes.js is pasted into all seven of
// them by hand. This test is what makes that safe: the pasted block must still
// match this file byte for byte, the ids it reaches for must exist in the
// markup, and the storage behaviour must survive a duplicate, an over-long list
// and a corrupted entry.
//   node tools/test-savedquotes.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { browserSource } from './page-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STYLE_PAGES = ['shakespeare.html', 'pirate.html', 'victorian.html',
  'chaucer.html', 'yoda.html', 'norse.html'];
const PAGES = [...STYLE_PAGES, 'index.html'];
const IDS = ['savedQuotes', 'savedQuotesEmpty', 'savedQuotesList', 'savedQuotesStatus'];
const KEY = 'repriser.savedQuotes';

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };
const section = (t) => console.log(`\n${t}`);

const norm = (s) => s.replace(/\r\n/g, '\n').trimEnd();
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const block = norm(browserSource(read('tools/savedquotes.js')));
const css = norm(read('tools/savedquotes.css'));

// --- 1. the pasted copy has not drifted -------------------------------------
section('verbatim copies');
for (const file of PAGES) {
  const page = norm(read(file));
  if (!page.includes(block)) no(`${file}: savedquotes.js block has drifted`);
}
const blockPages = PAGES.filter((f) => norm(read(f)).includes(block));
if (blockPages.length === PAGES.length) ok(`JS block identical in all ${PAGES.length} files`);

for (const file of PAGES) {
  const page = norm(read(file));
  if (!page.includes(css)) no(`${file}: savedquotes.css block has drifted`);
}
const cssPages = PAGES.filter((f) => norm(read(f)).includes(css));
if (cssPages.length === PAGES.length) ok(`CSS block identical in all ${PAGES.length} files`);

// --- 2. the markup the block reaches for exists -----------------------------
section('markup');
let markupBad = 0;
for (const file of PAGES) {
  const page = read(file);
  const missing = IDS.filter((id) => !page.includes(`id="${id}"`));
  if (missing.length) { no(`${file}: missing id(s) ${missing.join(', ')}`); markupBad++; }
  if (!page.includes('<section class="saved-quotes" id="savedQuotes">')) {
    no(`${file}: missing the saved-quotes section`);
    markupBad++;
  }
}
if (!markupBad) ok(`all ${IDS.length} ids and the section present in all ${PAGES.length} files`);

let saveBad = 0;
for (const file of STYLE_PAGES) {
  if (!read(file).includes('data-save-target="output"')) { no(`${file}: no Save button`); saveBad++; }
}
const dash = read('index.html');
const styles = ['Shakespeare', 'Pirate', 'Victorian', 'Chaucer', 'Yoda', 'Norse'];
const dashMissing = styles.filter((s) => !dash.includes(`data-save="${s}" data-save-target="out-${s.toLowerCase()}"`));
if (dashMissing.length) { no(`index.html: no Save button for ${dashMissing.join(', ')}`); saveBad++; }
if (!saveBad) ok('one Save button per style on the dashboard, one per style page');

// --- 3. behaviour through the page's own script -----------------------------
section('behaviour (shakespeare.html)');
const page = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
const quotes = page.api.savedQuotes;
const listEl = page.document.getElementById('savedQuotesList');

if (!quotes) {
  no('savedQuotes was not initialised by the page script');
} else {
  if (quotes.size() !== 0) no(`started with ${quotes.size()} quote(s)`);
  else ok('starts empty');

  const added = quotes.add('Hail, good morrow, friend', 'Shakespeare');
  const stored = JSON.parse(page.storage.getItem(KEY) || '[]');
  if (!added) no('add() refused a new quote');
  else if (quotes.size() !== 1) no(`size after add = ${quotes.size()}`);
  else if (!listEl.innerHTML.includes('Hail, good morrow, friend')) no('add() did not list the quote');
  else if (stored.length !== 1 || stored[0].style !== 'Shakespeare') no(`storage = ${JSON.stringify(stored)}`);
  else ok('save -> listed on screen and in localStorage');

  const again = quotes.add('Hail, good morrow, friend', 'Shakespeare');
  if (again) no('duplicate was accepted');
  else if (quotes.size() !== 1) no(`size after duplicate = ${quotes.size()}`);
  else ok('duplicate -> not re-added');

  quotes.add('The night is young', 'Shakespeare');
  if (quotes.size() !== 2) no(`size after second add = ${quotes.size()}`);
  else if (quotes.all()[0].text !== 'The night is young') no('newest quote is not first');
  else ok('second quote stored newest first');

  if (!quotes.remove(0)) no('remove() failed');
  else if (quotes.size() !== 1) no(`size after delete = ${quotes.size()}`);
  else if (listEl.innerHTML.includes('The night is young')) no('delete() left the row behind');
  else ok('delete -> removed from list and storage');

  // Cap: 55 stored entries must come back as 50, oldest dropped, and be
  // written back so storage cannot grow without bound.
  const many = Array.from({ length: 55 }, (v, i) => ({
    text: `quote number ${i}`, style: 'Quote', at: i,
  }));
  page.storage.setItem(KEY, JSON.stringify(many));
  const capped = quotes.reload();
  const afterCap = JSON.parse(page.storage.getItem(KEY) || '[]');
  if (capped !== 50) no(`cap: ${capped} quotes survived, expected 50`);
  else if (afterCap.length !== 50) no(`cap: storage still holds ${afterCap.length}`);
  else if (afterCap[0].text !== 'quote number 0') no('cap: oldest entries were dropped first');
  else ok('cap -> 50 kept, oldest dropped, storage rewritten');

  // Corruption: not fatal, and it cleans itself up.
  page.storage.setItem(KEY, '{ this is not json');
  const recovered = quotes.reload();
  if (recovered !== 0) no(`corrupt storage: ${recovered} quote(s) recovered`);
  else if (page.storage.getItem(KEY) !== '[]') no('corrupt storage was not overwritten');
  else ok('corrupt JSON -> recovers empty and overwrites the bad entry');

  // No storage at all (file:// in some browsers, private modes): the list
  // still works for the session and says why it is not permanent.
  const realSetItem = page.storage.setItem;
  page.storage.setItem = () => { throw new Error('denied'); };
  quotes.reload();
  const available = quotes.available();
  const message = page.document.getElementById('savedQuotesStatus').textContent;
  page.storage.setItem = realSetItem;
  if (available) no('unavailable storage still reported as available');
  else if (!/unavailable/i.test(message)) no(`no explanation shown: ${JSON.stringify(message)}`);
  else ok('storage refused -> session-only list, message shown');
}

console.log('');
console.log(failures ? `${failures} check(s) FAILED` : 'all saved-quote checks passed');
process.exitCode = failures ? 1 : 0;
