// Gate for the quote card: the generic strip must remove all asides and stage
// directions, and must not mangle ordinary text.
//   node tools/test-quotecard.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { loadPage } from './harness.mjs';
import { CORPUS, SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(ROOT, 'tools', 'quotecard.js'), 'utf8');
const sandbox = { console, module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'quotecard.js' });
const Q = sandbox.module.exports;

const PAGES = [
  ['shakespeare.html', 'shakespearify'],
  ['pirate.html', 'pirateify'],
  ['victorian.html', 'victorianify'],
  ['chaucer.html', 'chaucerify'],
  ['yoda.html', 'yodaify'],
  ['norse.html', 'norseify'],
];

// A deterministic stand-in for ctx.measureText: ~0.5em per character.
const stubMeasure = (s, f) => s.length * f * 0.5;

let failures = 0;
const fail = (m) => { console.log(`FAIL  ${m}`); failures++; };
const pass = (m) => console.log(`ok    ${m}`);

// ---- 1. strip removes stage business, keeps the speech -------------------
let withBusiness = 0;
let residual = 0;
let emptied = 0;
let checked = 0;
let shown = 0;

// The strip may only ever DELETE, never insert. Checked as a real subsequence
// over whitespace-stripped text: removing a span can join its neighbours
// ("A [X] B" -> "A B"), so a plain substring test would be wrong.
// Index by code unit, not with for..of: the corpus includes emoji, and for..of
// yields code points (so a surrogate pair arrives as one char) while `small` is
// indexed by UTF-16 unit, which would report a false mismatch.
function isSubsequence(small, big) {
  let i = 0;
  for (let j = 0; j < big.length && i < small.length; j++) {
    if (small[i] === big[j]) i++;
  }
  return i === small.length;
}

for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  for (const input of CORPUS) {
    for (const seed of SEEDS) {
      const out = page.transform(input, seed);
      if (!out.trim()) continue;
      checked++;

      const hadBusiness = /\(aside:|\[[^\]]*\]/.test(out);
      if (hadBusiness) withBusiness++;

      const clean = Q.stripStageBusiness(out);
      if (/\(aside:/i.test(clean) || /\[[^\]]*\]/.test(clean)) residual++;
      if (!clean) emptied++;

      if (clean && !isSubsequence(clean.replace(/\s/g, ''), out.replace(/\s/g, ''))) {
        if (shown < 3) {
          shown++;
          console.log(`\n  input : ${JSON.stringify(input)}`);
          console.log(`  out   : ${JSON.stringify(out)}`);
          console.log(`  clean : ${JSON.stringify(clean)}`);
        }
        fail(`${file}: strip inserted text that was not in the original`);
      }
    }
  }
}

console.log(`\nchecked ${checked} outputs, ${withBusiness} contained asides/stage directions\n`);
if (residual) fail(`${residual} output(s) still contain stage business after strip`);
else pass('no residual asides or stage directions');
if (withBusiness === 0) fail('no output ever contained stage business - the test proves nothing');
else pass(`strip is exercised (${withBusiness} outputs had stage business)`);
if (emptied) fail(`${emptied} output(s) became empty after strip`);
else pass('no non-empty output became empty');

// ---- 2. known stage business is caught ----------------------------------
const SAMPLES = [
  ['Fine, my thanks.\n  (aside: Patience, good heart!)\n', 'Fine, my thanks.'],
  ['By this light!\n  [He draws his sword.]\n', 'By this light!'],
  ['A\n  (aside: O, what a fool am I!)\n  [Exit, pursued by a bear.]\nB', 'A B'],
];
for (const [input, want] of SAMPLES) {
  const got = Q.stripStageBusiness(input);
  if (got !== want) fail(`strip(${JSON.stringify(input)}) -> ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
pass('known asides and stage directions removed');

// ---- 3. ordinary text survives ------------------------------------------
const KEEP = [
  'Hail how dost thou fare this day',
  'Thou art so blisful to seen my freend',
  'A comma, to trigger the metaphor insert, in the middle.',
];
for (const text of KEEP) {
  if (Q.stripStageBusiness(text) !== text) fail(`strip altered clean text: ${JSON.stringify(text)}`);
}
pass('clean text is returned unchanged');

// ---- 4. layout: wrapping, font shrinking, truncation --------------------
// Geometry comes from the module so these cannot drift from the real card.
const PAD = Q.CARD_W / 2 - (Q.CARD_W - 2 * 96) / 2; // 96, the shipped pad
const WIDE = {
  maxWidth: Q.CARD_W - 96 * 2,
  maxHeight: 1140 - 210,
  minFont: Q.CARD_FONT_MIN,
  maxFont: Q.CARD_FONT_MAX,
};
const NARROW = { maxWidth: 300, maxHeight: 400, minFont: Q.CARD_FONT_MIN, maxFont: Q.CARD_FONT_MAX };

let l = Q.layoutCard('one two three four five six seven eight', stubMeasure, WIDE);
if (l.lines.length < 1) fail('layout produced no lines');
if (l.font > Q.CARD_FONT_MAX) fail(`font exceeded the maximum: ${l.font}`);
else pass(`short text uses ${l.font}px across ${l.lines.length} line(s), truncated=${l.truncated}`);

// A short quote should scale UP to fill the card rather than sit small.
const SHORT = 'Dangerous, this path is. Welcome My Friend';
const grown = Q.layoutCard(SHORT, stubMeasure, WIDE);
if (grown.font < 100) fail(`short quote only reached ${grown.font}px; it should fill the card`);
else pass(`short quote scaled up to ${grown.font}px`);

l = Q.layoutCard('one two three four five six seven eight', stubMeasure, NARROW);
const joined = l.lines.join(' ');
if (joined.replace(/\s+/g, ' ') !== 'one two three four five six seven eight') {
  fail(`narrow wrap lost or duplicated words: ${JSON.stringify(joined)}`);
}
if (l.lines.some((x) => stubMeasure(x, l.font) > NARROW.maxWidth)) {
  fail('a wrapped line exceeds maxWidth');
}
pass(`narrow wrap produced ${l.lines.length} lines, none overflowing`);

// Long enough that even the minimum font cannot fit it, so truncation is
// genuinely forced rather than merely avoided by shrinking.
const LONG = 'the quick brown fox jumps over the lazy dog while the morning sun rises '.repeat(60);
l = Q.layoutCard(LONG, stubMeasure, WIDE);
if (!l.truncated) fail(`very long text was not marked truncated (${l.lines.length} lines at ${l.font}px)`);
if (!l.lines[l.lines.length - 1].endsWith('…')) fail('truncation does not end with an ellipsis');
if (l.lines.length * l.lineHeight > WIDE.maxHeight + 1) fail('truncated layout still overflows the box');
if (l.font < Q.CARD_FONT_MIN) fail(`font fell below the minimum: ${l.font}`);
pass(`long text forced truncation at ${l.font}px over ${l.lines.length} lines`);

l = Q.layoutCard('', stubMeasure, WIDE);
if (l.lines.length !== 0) fail('empty input produced lines');
if (l.truncated) fail('empty input marked truncated');
pass('empty input yields an empty layout');

// A single unbroken token longer than the column must be split, not overflow.
l = Q.layoutCard('x'.repeat(500), stubMeasure, WIDE);
if (l.lines.some((x) => stubMeasure(x, l.font) > WIDE.maxWidth)) {
  fail('an unbreakable token overflowed the column');
}
pass('unbreakable token is hard-split');

// ---- 5. long text: shrink to fit, warn, stay inside the zone ---------------
// 420 chars must be absorbed by shrinking, not by cutting: everything up to
// the readability floor fits, and only past that is text dropped.
const MEDIUM = 'the brave soldier carried the bright banner across the ancient bridge '.repeat(6);
l = Q.layoutCard(MEDIUM, stubMeasure, WIDE);
if (l.truncated) fail(`medium text was cut (${l.font}px, ${l.lines.length} lines)`);
else if (l.font < Q.CARD_FONT_MIN) fail(`font fell below the floor: ${l.font}`);
else if (l.lines.some((x) => stubMeasure(x, l.font) > WIDE.maxWidth)) {
  fail('medium text overflowed the column');
} else pass(`420-char quote fits uncut by shrinking to ${l.font}px`);

// The opening and closing quote marks are drawn around the text, so the budget
// has to reserve them: a full card must not push the group into the top
// ornament (y=150) or past the footer rule (y=1140).
const MARK_STACK = 0.46 + 0.08 + 0.26 + 0.4;   // must match drawCard's geometry
const groupHeight = (lay) => lay.lines.length * lay.lineHeight + lay.font * MARK_STACK;
for (const [label, sample] of [['medium', MEDIUM], ['truncated', LONG], ['short', SHORT]]) {
  const g = Q.layoutCard(sample, stubMeasure, WIDE);
  if (groupHeight(g) > WIDE.maxHeight + 1) {
    fail(`${label}: quote group is ${Math.round(groupHeight(g))}px, zone is ${WIDE.maxHeight}px`);
  }
}
pass('opening mark + text + closing mark fit the content zone at every length');

// The preview must be able to tell the user what happened.
const warnCases = [
  ['short quote', SHORT, null],
  ['long-but-fits quote', MEDIUM, 'long'],
  ['overflowing quote', LONG, 'cut'],
  ['empty input', '', null],
];
for (const [what, input, want] of warnCases) {
  const got = Q.cardWarning(Q.layoutCard(input, stubMeasure, WIDE));
  if (got !== want) fail(`${what}: warning ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
pass('warnings: comfortable=null, shrunk=long, cut short=cut');

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall quote-card checks passed');
process.exitCode = failures ? 1 : 0;
