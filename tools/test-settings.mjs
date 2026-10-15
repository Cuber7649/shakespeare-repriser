// The can't-drift + behaviour gate for the transformation-settings block.
//
// The pages are standalone, so tools/options.{js,css,html} are pasted into all
// seven of them by hand. This test is what makes that safe: the pasted blocks
// must still match byte for byte, the ids they reach for must exist, the
// defaults must reproduce the engine's original (balanced) behaviour exactly,
// and the toggles and intensity must actually gate the pipeline.
//   node tools/test-settings.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { browserSource } from './page-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STYLE_PAGES = ['shakespeare.html', 'pirate.html', 'victorian.html',
  'chaucer.html', 'yoda.html', 'norse.html'];
const PAGES = [...STYLE_PAGES, 'index.html'];
const IDS = ['optionsPanel', 'optIntensity', 'optOpenings', 'optMetaphors',
  'optAsides', 'optInvert', 'optResetBtn', 'optStatus'];

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };
const section = (t) => console.log(`\n${t}`);

const norm = (s) => s.replace(/\r\n/g, '\n');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const js = norm(browserSource(read('tools/options.js')));
const css = norm(read('tools/options.css'));
const html = norm(read('tools/options.html'));

// --- 1. the pasted copies have not drifted -----------------------------------
section('verbatim copies');
for (const file of PAGES) {
  const page = norm(read(file));
  if (!page.includes(js)) no(`${file}: options.js block has drifted`);
  if (!page.includes(css)) no(`${file}: options.css block has drifted`);
  if (!page.includes(html)) no(`${file}: options.html block has drifted`);
}
const complete = PAGES.filter((f) => {
  const p = norm(read(f));
  return p.includes(js) && p.includes(css) && p.includes(html);
});
if (complete.length === PAGES.length) ok(`JS, CSS and HTML blocks identical in all ${PAGES.length} files`);

// --- 2. the markup the block reaches for exists ------------------------------
section('markup');
let markupBad = 0;
for (const file of PAGES) {
  const page = read(file);
  const missing = IDS.filter((id) => !page.includes(`id="${id}"`));
  if (missing.length) { no(`${file}: missing id(s) ${missing.join(', ')}`); markupBad++; }
}
if (!markupBad) ok(`all ${IDS.length} ids present in all ${PAGES.length} files`);

// --- 3. defaults reproduce the original (balanced) behaviour -----------------
section('balanced defaults');

// Golden outputs captured BEFORE the settings block existed, at seed 42.
const GOLDEN = [
  ['shakespeare.html', 'shakespearify', 'hello how are you today',
    'By this light! Hail how dost thou fare this day'],
  ['shakespeare.html', 'shakespearify', 'you are my friend and I am happy',
    'By this light! Thou art my good fellow and I am merry'],
  ['yoda.html', 'yodaify', 'you are my friend and I am happy',
    'Are you my friend and I am happy'],
  ['norse.html', 'norseify', 'hello how are you today',
    'Hear my words! Hail how fare ye this day'],
];
for (const [file, entry, input, want] of GOLDEN) {
  const page = loadPage(join(ROOT, file), entry);
  const got = page.transform(input, 42);
  if (got === want) ok(`${file}: ${JSON.stringify(input.slice(0, 32))}... byte-identical`);
  else no(`${file}: ${JSON.stringify(input)}\n        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`);
}

// --- 4. getTransformOptions reads the controls and falls back to defaults -----
section('getTransformOptions');
{
  const p = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
  const d = p.api.getTransformOptions();
  const isDefault = d.intensity === 'balanced' && d.openings === true
    && d.metaphors === true && d.asides === true && d.invert === true;
  if (isDefault) ok('missing controls -> balanced defaults (all toggles on)');
  else no(`defaults wrong: ${JSON.stringify(d)}`);

  // Drive the stubs the way a user would.
  p.document.getElementById('optIntensity').value = 'light';
  p.document.getElementById('optOpenings').checked = false;
  p.document.getElementById('optInvert').checked = false;
  const d2 = p.api.getTransformOptions();
  if (d2.intensity === 'light' && d2.openings === false && d2.invert === false
    && d2.metaphors === true && d2.asides === true) {
    ok('reads intensity + toggles from the controls');
  } else {
    no(`control read wrong: ${JSON.stringify(d2)}`);
  }
}

// --- 5. toggles and intensity actually gate the pipeline ---------------------
section('gating');

function withOpts(page, mut) {
  // Reset the stubs to defaults, apply a mutation, transform.
  const ids = ['optOpenings', 'optMetaphors', 'optAsides', 'optInvert'];
  for (const id of ids) page.document.getElementById(id).checked = true;
  page.document.getElementById('optIntensity').value = 'balanced';
  mut(page.document);
  return page;
}

{
  const p = loadPage(join(ROOT, 'shakespeare.html'), 'shakespearify');
  const input = 'hello how are you today';
  const seed = 42;

  const balanced = withOpts(p, () => {}).transform(input, seed);
  const noOpenings = withOpts(p, (doc) => { doc.getElementById('optOpenings').checked = false; }).transform(input, seed);
  if (balanced.includes('By this light!') && !noOpenings.includes('By this light!')) {
    ok('openings toggle removes the opening exclamation');
  } else {
    no(`openings toggle ineffective: balanced=${JSON.stringify(balanced)} off=${JSON.stringify(noOpenings)}`);
  }

  const light = withOpts(p, (doc) => { doc.getElementById('optIntensity').value = 'light'; }).transform(input, seed);
  if (!light.includes('By this light!') && light.split(/\s+/).length <= balanced.split(/\s+/).length) {
    ok('Light skips the opening and never adds more words than Balanced');
  } else {
    no(`Light ineffective: ${JSON.stringify(light)} (balanced ${JSON.stringify(balanced)})`);
  }

  const noInvert = withOpts(p, (doc) => { doc.getElementById('optInvert').checked = false; }).transform('he is going home', 7);
  const withInvert = withOpts(p, () => {}).transform('he is going home', 7);
  if (noInvert !== withInvert) ok('invert toggle changes an inversion-triggering sentence');
  else no(`invert toggle ineffective: both ${JSON.stringify(withInvert)}`);
}

console.log(failures ? `\n${failures} settings check(s) failed` : '\nevery settings check passed');
process.exitCode = failures ? 1 : 0;
