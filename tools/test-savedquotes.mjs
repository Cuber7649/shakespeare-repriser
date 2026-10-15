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
const IDS = ['savedQuotes', 'savedQuotesEmpty', 'savedQuotesList', 'savedQuotesStatus',
  'sqSearch', 'sqFilter', 'sqTitle', 'sqExport', 'sqImportBtn', 'sqImport', 'sqClear'];
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

  // --- v2: structured records, search, filter, import/export, clear --------
  section('v2 records and features (shakespeare.html)');

  // Migration: v1-shaped records ({text, style, at}) load with the new fields
  // defaulted, and the old `text` field is preserved as the output.
  page.storage.setItem(KEY, JSON.stringify([
    { text: 'A v1 quote', style: 'Pirate', at: 1000 },
  ]));
  quotes.reload();
  const migrated = quotes.all()[0];
  if (!migrated) no('migration: v1 record did not load');
  else if (migrated.text !== 'A v1 quote') no(`migration: text = ${JSON.stringify(migrated.text)}`);
  else if (migrated.style !== 'Pirate') no(`migration: style = ${JSON.stringify(migrated.style)}`);
  else if (typeof migrated.id !== 'string' || !migrated.id) no('migration: no id assigned');
  else if (migrated.original !== '') no('migration: original should default to empty');
  else if (migrated.title !== '') no('migration: title should default to empty');
  else ok('v1 record migrated with id, defaults preserved');

  // A second v1 record must receive a distinct id.
  page.storage.setItem(KEY, JSON.stringify([
    { text: 'First', style: 'Yoda', at: 1 },
    { text: 'Second', style: 'Yoda', at: 2 },
  ]));
  quotes.reload();
  const ids = quotes.all().map((q) => q.id);
  if (ids.length !== 2 || ids[0] === ids[1]) no(`ids not unique: ${JSON.stringify(ids)}`);
  else ok('each record gets a unique id');

  // Save with original, settings and a title.
  quotes.clearAll();
  const settings = { intensity: 'dramatic', openings: false, metaphors: true, asides: true, invert: false };
  const saved = quotes.add('To be or not to be', 'Shakespeare', 'Original text here', settings, 'My title');
  const rec = quotes.all()[0];
  if (!saved) no('add with metadata refused');
  else if (rec.original !== 'Original text here') no(`original not stored: ${JSON.stringify(rec.original)}`);
  else if (!rec.settings || rec.settings.intensity !== 'dramatic') no(`settings not stored: ${JSON.stringify(rec.settings)}`);
  else if (rec.title !== 'My title') no(`title not stored: ${JSON.stringify(rec.title)}`);
  else ok('original, settings and title stored on save');

  // Search matches across output, original, style and title.
  quotes.add('Hail Caesar', 'Pirate', 'another original', null, 'Caesar greeting');
  quotes.setQuery('caesar');
  let visible = listEl.innerHTML;
  if (!visible.includes('Hail Caesar') || visible.includes('To be or not')) {
    no(`search "caesar" wrong results: ${visible.slice(0, 120)}`);
  } else ok('search matches title and output, excludes non-matches');
  quotes.setQuery('another original');
  if (!listEl.innerHTML.includes('Hail Caesar')) no('search did not match original text');
  else ok('search matches the original input');
  quotes.setQuery('');

  // Filter by style.
  quotes.setFilter('Pirate');
  visible = listEl.innerHTML;
  if (!visible.includes('Hail Caesar') || visible.includes('To be or not')) {
    no(`filter Pirate wrong results: ${visible.slice(0, 120)}`);
  } else ok('filter shows only the matching style');
  quotes.setFilter('');

  // Use: loads original into the input and the saved output into #output.
  const useTarget = rec.id;
  const inputEl = page.document.getElementById('input');
  inputEl.value = 'something else';
  page.document.getElementById('output').textContent = '';
  if (!quotes.use(useTarget)) no('use() failed');
  else if (inputEl.value !== 'Original text here') no(`use did not restore input: ${JSON.stringify(inputEl.value)}`);
  else if (page.document.getElementById('output').textContent !== 'To be or not to be') {
    no('use did not restore the output');
  } else ok('Use restores original input and saved output');

  // Export: returns a versioned envelope with the current items.
  const exported = quotes.exportData();
  if (!exported || exported.version !== 1 || !Array.isArray(exported.items)) {
    no(`exportData shape wrong: ${JSON.stringify(exported && exported.version)}`);
  } else if (exported.items.length !== quotes.size()) {
    no(`exportData has ${exported.items.length} items, expected ${quotes.size()}`);
  } else ok('exportData returns { version: 1, items }');

  // Import: valid file adds new items, duplicates are skipped, malformed and
  // wrong-shaped files are rejected with a message, not a crash.
  quotes.clearAll();
  quotes.add('Existing quote', 'Shakespeare');
  const goodImport = JSON.stringify({
    version: 1,
    items: [
      { text: 'Imported one', style: 'Norse', at: 5 },
      { text: 'Existing quote', style: 'Shakespeare', at: 6 },  // duplicate output
      { text: 'Imported two', style: 'Yoda', at: 7 },
    ],
  });
  const result = quotes.importText(goodImport);
  if (result.error) no(`importText failed: ${result.error}`);
  else if (result.added !== 2) no(`import added ${result.added}, expected 2`);
  else if (result.skipped !== 1) no(`import skipped ${result.skipped}, expected 1`);
  else if (quotes.size() !== 3) no(`size after import = ${quotes.size()}, expected 3`);
  else ok('import adds new items and skips duplicates');

  const dupIds = quotes.importText(JSON.stringify({
    version: 1,
    items: [{ id: quotes.all()[0].id, text: 'Collides with existing id', style: 'Norse', at: 9 }],
  }));
  const idList = quotes.all().map((q) => q.id);
  if (new Set(idList).size !== idList.length) no('duplicate id was not remapped');
  else ok('import remaps a colliding id');

  const badJson = quotes.importText('{ not json');
  if (!badJson.error || !/json/i.test(badJson.error)) no(`bad JSON: ${JSON.stringify(badJson)}`);
  else ok('malformed JSON rejected with a message');

  const badShape = quotes.importText(JSON.stringify({ hello: 'world' }));
  if (!badShape.error) no('wrong-shaped import accepted');
  else ok('wrong-shaped import rejected');

  const futureVersion = quotes.importText(JSON.stringify({ version: 99, items: [] }));
  if (!futureVersion.error) no('newer schema version accepted');
  else ok('newer schema version rejected');

  // Clear all empties the list and storage.
  quotes.clearAll();
  if (quotes.size() !== 0) no(`clearAll left ${quotes.size()} item(s)`);
  else if (JSON.parse(page.storage.getItem(KEY) || '[]').length !== 0) no('clearAll did not empty storage');
  else ok('clear all empties list and storage');

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
