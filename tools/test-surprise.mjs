// "Surprise Me!" feature: sample selection, consecutive-repeat prevention,
// input / character-count updates, and transform triggering on every page.
//
//   node tools/test-surprise.mjs

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

const norm = (s) => s.replace(/\r\n/g, '\n');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const js = norm(browserSource(read('tools/surprise.js')));

// --- 1. verbatim copies -------------------------------------------------------
section('verbatim copies');
for (const file of PAGES) {
  const page = norm(read(file));
  if (!page.includes(js)) no(`${file}: surprise.js block has drifted`);
}
const complete = PAGES.filter((f) => norm(read(f)).includes(js));
if (complete.length === PAGES.length) ok(`surprise.js identical in all ${PAGES.length} files`);

// --- 2. the markup the feature reaches for exists -----------------------------
section('markup');
const surpriseIds = ['input', 'charCount'];
let markupBad = 0;
for (const file of PAGES) {
  const page = read(file);
  const missing = surpriseIds.filter((id) => !page.includes(`id="${id}"`));
  if (missing.length) { no(`${file}: missing id(s) ${missing.join(', ')}`); markupBad++; }
}
if (!markupBad) ok(`all ${surpriseIds.length} ids present in all ${PAGES.length} files`);

// --- 3. sample selection ------------------------------------------------------
section('sample selection');
const page = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
const api = page.api;
if (typeof api.surprisePick !== 'function') {
  no('surprisePick not exposed on shakespeare page');
} else {
  api.surpriseLastIndex = -1;
  const seen = new Set();
  let bad = 0;
  for (let i = 0; i < 100; i++) {
    const s = api.surprisePick();
    if (typeof s !== 'string' || s.length === 0) { bad++; continue; }
    seen.add(s);
  }
  if (bad > 0) no(`surprisePick returned invalid ${bad} time(s)`);
  else if (seen.size > 1) ok(`surprisePick returns varied samples (${seen.size} distinct)`);
  else no(`surprisePick not varied: ${JSON.stringify([...seen])}`);
}

// --- 4. consecutive-repeat prevention ----------------------------------------
section('consecutive-repeat prevention');
{
  api.surpriseLastIndex = -1;
  const first = api.surprisePick();
  const second = api.surprisePick();
  if (first !== '' && second !== '' && first !== second) {
    ok('consecutive picks differ');
  } else {
    no(`consecutive repeats: first=${JSON.stringify(first)} second=${JSON.stringify(second)}`);
  }

  // A long run should never emit the same sentence back-to-back.
  api.surpriseLastIndex = -1;
  let prev = null;
  let repeats = 0;
  for (let i = 0; i < 200; i++) {
    const s = api.surprisePick();
    if (prev !== null && s === prev) repeats++;
    prev = s;
  }
  if (repeats === 0) ok('no consecutive repeats across 200 picks');
  else no(`${repeats} consecutive repeat(s) across 200 picks`);
}

// --- 5. empty / single-item pool edge cases ----------------------------------
section('pool edge cases');
// Empty pool: surprisePick returns ''
{
  const p = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
  const arr = p.api.SURPRISE_SENTENCES;
  const saved = arr.slice();
  arr.length = 0; // empty in place (same object surprisePick closes over)
  p.api.surpriseLastIndex = -1;
  const s = p.api.surprisePick();
  arr.push(...saved); // restore
  if (s === '') ok('empty pool returns empty string');
  else no(`empty pool returned ${JSON.stringify(s)}`);
}
// Single-item pool: always returns that item
{
  const p = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
  const arr = p.api.SURPRISE_SENTENCES;
  const saved = arr.slice();
  arr.length = 0;
  arr.push('only one sentence');
  p.api.surpriseLastIndex = -1;
  const s1 = p.api.surprisePick();
  const s2 = p.api.surprisePick();
  arr.length = 0;
  arr.push(...saved); // restore
  if (s1 === 'only one sentence' && s2 === 'only one sentence') {
    ok('single-item pool always returns the item');
  } else {
    no(`single-item pool: ${JSON.stringify(s1)} / ${JSON.stringify(s2)}`);
  }
}

// --- 6. surpriseApply updates input, char count, triggers transform ----------
section('surpriseApply');
{
  const p = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
  const inputEl = p.document.getElementById('input');
  const charCountEl = p.document.getElementById('charCount');
  const outputEl = p.document.getElementById('output');

  p.api.surpriseLastIndex = -1;
  p.api.surpriseApply(inputEl, charCountEl, p.api.shakespearify);

  const inputVal = inputEl.value;
  const charCount = charCountEl.textContent;
  const outputVal = outputEl.textContent;

  if (inputVal.length > 0 && charCount === String(inputVal.length)) {
    ok(`input set to sample and char count matches (${inputVal.length} chars)`);
  } else {
    no(`input/charCount mismatch: input=${JSON.stringify(inputVal)} charCount=${JSON.stringify(charCount)}`);
  }

  if (outputVal.length > 0 && outputVal !== inputVal) {
    ok('transform was triggered (output differs from input)');
  } else {
    no(`transform not triggered: output=${JSON.stringify(outputVal)}`);
  }

  // All produced outputs come from the sample pool
  let inPool = true;
  for (let i = 0; i < 20; i++) {
    p.api.surpriseLastIndex = -1;
    p.api.surpriseApply(inputEl, charCountEl, p.api.shakespearify);
    if (!p.api.SURPRISE_SENTENCES.includes(inputEl.value)) { inPool = false; break; }
  }
  if (inPool) ok('every surprise input is from the sample pool');
  else no('some surprise input is not from the sample pool');
}

// --- 7. surprise button present on every page ---------------------------------
section('surprise button');
let btnBad = 0;
for (const file of PAGES) {
  const page = read(file);
  if (!page.includes('surpriseApply(inputEl, charCountEl')) {
    no(`${file}: surpriseApply button wiring missing`);
    btnBad++;
  }
}
if (!btnBad) ok(`Surprise Me button wired in all ${PAGES.length} pages`);

// --- 8. existing features preserved ------------------------------------------
section('existing features preserved');
{
  const p = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
  // Transform still works after surprise wiring
  const out = p.transform('hello how are you today', 42);
  if (out.length > 0 && out !== 'hello how are you today') {
    ok('transform still works after surprise changes');
  } else {
    no(`transform broken: ${JSON.stringify(out)}`);
  }
  // Clear still works
  const inputEl = p.document.getElementById('input');
  const charCountEl = p.document.getElementById('charCount');
  inputEl.value = 'some text';
  charCountEl.textContent = '9';
  if (typeof p.api.clearAll === 'function') {
    p.api.clearAll();
    if (inputEl.value === '' && charCountEl.textContent === '0') {
      ok('clearAll still resets input and char count');
    } else {
      no('clearAll does not reset input/char count');
    }
  } else {
    no('clearAll not exposed');
  }
}

console.log(failures ? `\n${failures} surprise check(s) failed` : '\nall surprise checks passed');
process.exitCode = failures ? 1 : 0;
