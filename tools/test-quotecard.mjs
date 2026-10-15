// Gate for the quote card: the generic strip must remove all asides and stage
// directions, and must not mangle ordinary text. Also covers the appearance
// options: skins (with contrast guarantees), backgrounds, alignment and the
// original-text band.
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

// ---- 6. skins: complete palettes and readable contrast --------------------
const SKIN_FIELDS = ['from', 'mid', 'to', 'ink', 'accent', 'labelInk', 'markInk', 'vig'];
const skinIds = Object.keys(Q.CARD_SKINS);
if (skinIds.length < 3) fail(`only ${skinIds.length} skin(s); expected at least 3`);
for (const id of skinIds) {
  const missing = SKIN_FIELDS.filter((f) => !Q.CARD_SKINS[id][f]);
  if (missing.length) fail(`skin ${id}: missing ${missing.join(', ')}`);
}
pass(`skins defined: ${skinIds.join(', ')}`);

// WCAG contrast. Quote ink is display type but held to the 4.5 body-text bar;
// the muted label/band ink is large text (>=24px), where 3:1 is the standard.
function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lumOf(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255);
}
function contrastRatio(a, b) {
  const [l1, l2] = [lumOf(a), lumOf(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
for (const id of skinIds) {
  const s = Q.CARD_SKINS[id];
  for (const stop of ['from', 'mid', 'to']) {
    const ink = contrastRatio(s.ink, s[stop]);
    if (ink < 4.5) fail(`skin ${id}: ink on ${stop} is ${ink.toFixed(2)}:1, need 4.5`);
    const label = contrastRatio(s.labelInk, s[stop]);
    if (label < 3) fail(`skin ${id}: labelInk on ${stop} is ${label.toFixed(2)}:1, need 3`);
  }
}
pass('every skin keeps ink >= 4.5:1 and labelInk >= 3:1 against all three background stops');

// resolveCardSkin: auto keeps the page style's tints with classic ink; a named
// skin overrides colours but keeps the style label.
const auto = Q.resolveCardSkin('shakespeare', 'auto');
if (auto.from !== Q.CARD_THEMES.shakespeare.from || auto.ink !== '#3d2b1f') {
  fail(`auto skin drifted: ${JSON.stringify(auto)}`);
} else pass("auto skin keeps the page style's tints with the classic ink");
const unknown = Q.resolveCardSkin('pirate', 'no-such-skin');
if (unknown.from !== Q.CARD_THEMES.pirate.from || unknown.label !== 'Pirate') {
  fail('unknown skin id should fall back to the auto palette');
} else pass('unknown skin id falls back to auto');
const midnight = Q.resolveCardSkin('shakespeare', 'midnight');
if (midnight.label !== 'Shakespeare' || midnight.ink !== Q.CARD_SKINS.midnight.ink) {
  fail('named skin must override colours but keep the style label');
} else pass('named skin overrides colours, keeps the style label');

// ---- 7. original-text band -------------------------------------------------
const ORIG = 'The original modern English input';
let withOrig = Q.layoutCard(MEDIUM, stubMeasure, Object.assign({}, WIDE, { original: ORIG }));
let without = Q.layoutCard(MEDIUM, stubMeasure, WIDE);
if (!withOrig.original) fail('original option produced no band');
else {
  if (withOrig.original.lines.join(' ') !== ORIG) fail('band does not carry the original text');
  if (withOrig.original.blockHeight <= withOrig.original.lines.length * withOrig.original.lineHeight) {
    fail('band blockHeight leaves no gap above the rule');
  }
  // The band is carved out of the quote budget, so the quote can never grow
  // into it: same text, with vs without, must not get bigger.
  if (withOrig.font > without.font || withOrig.lines.length > without.lines.length) {
    fail(`band did not reduce the quote budget (${withOrig.font}px/${withOrig.lines.length} vs ${without.font}px/${without.lines.length})`);
  }
  const zone = withOrig.lines.length * withOrig.lineHeight
    + withOrig.font * (0.46 + 0.26 + 0.08 + 0.4) + withOrig.original.blockHeight;
  if (zone > WIDE.maxHeight + 1) fail(`quote+band group is ${Math.round(zone)}px, zone is ${WIDE.maxHeight}px`);
  else pass(`quote+band fit the content zone (${Math.round(zone)}px of ${WIDE.maxHeight}px)`);
}
const LONG_ORIG = 'word '.repeat(60);
const cutBand = Q.layoutCard(SHORT, stubMeasure, Object.assign({}, WIDE, { original: LONG_ORIG }));
if (!cutBand.original || !cutBand.original.truncated) fail('oversized original band was not marked truncated');
else if (cutBand.original.lines.length !== Q.CARD_ORIGINAL_MAX_LINES) {
  fail(`band has ${cutBand.original.lines.length} lines, cap is ${Q.CARD_ORIGINAL_MAX_LINES}`);
} else if (!cutBand.original.lines[Q.CARD_ORIGINAL_MAX_LINES - 1].endsWith('…')) {
  fail('band truncation does not end with an ellipsis');
} else pass(`oversized band capped at ${Q.CARD_ORIGINAL_MAX_LINES} lines with an ellipsis`);
if (Q.layoutCard(SHORT, stubMeasure, WIDE).original !== null) fail('no original option should yield no band');
else pass('without the option there is no band');

// ---- 8. backgrounds and alignment through drawCard -------------------------
function makeFakeCtx() {
  const calls = { fillText: [], fillRect: 0, strokeRect: 0, linear: 0, radial: 0 };
  return {
    calls, font: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
    textBaseline: '', textAlign: '',
    scale() {}, clearRect() {},
    fillRect() { calls.fillRect++; },
    strokeRect() { calls.strokeRect++; },
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, fill() {},
    measureText(s) {
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font);
      return { width: String(s).length * (m ? parseFloat(m[1]) : 10) * 0.5 };
    },
    fillText(s, x, y) {
      calls.fillText.push({
        text: String(s), x, y, font: this.font,
        fillStyle: this.fillStyle, textAlign: this.textAlign,
      });
    },
    createLinearGradient() { calls.linear++; return { addColorStop() {} }; },
    createRadialGradient() { calls.radial++; return { addColorStop() {} }; },
  };
}
const theme = Q.resolveCardSkin('shakespeare', 'auto');
const cardLayout = Q.layoutCard(SHORT, stubMeasure, WIDE);
const bgCases = [
  ['gradient (default)', {}, { linear: 1, radial: 1 }],
  ['flat', { background: 'flat' }, { linear: 0, radial: 0 }],
  ['wash', { background: 'wash' }, { linear: 0, radial: 1 }],
];
for (const [what, opts, want] of bgCases) {
  const ctx = makeFakeCtx();
  Q.drawCard(ctx, cardLayout, theme, opts);
  if (ctx.calls.linear !== want.linear || ctx.calls.radial !== want.radial) {
    fail(`${what}: created ${ctx.calls.linear} linear / ${ctx.calls.radial} radial gradient(s), want ${want.linear}/${want.radial}`);
  } else if (!ctx.calls.fillRect) fail(`${what}: background was not filled`);
  else pass(`${what}: background painted with ${want.linear} linear, ${want.radial} radial gradient(s)`);
}
for (const [what, opts, wantX, wantAlign] of [
  ['left (default)', {}, Q.CARD_PAD, 'left'],
  ['center', { align: 'center' }, Q.CARD_W / 2, 'center'],
  ['right', { align: 'right' }, Q.CARD_W - Q.CARD_PAD, 'right'],
]) {
  const ctx = makeFakeCtx();
  Q.drawCard(ctx, cardLayout, theme, opts);
  const lines = ctx.calls.fillText.filter((c) => /italic 400/.test(c.font));
  if (!lines.length) fail(`${what}: no quote lines drawn`);
  else if (lines.some((c) => c.textAlign !== wantAlign || c.x !== wantX)) {
    fail(`${what}: lines drawn at x=${lines[0].x} align=${lines[0].textAlign}, want x=${wantX} align=${wantAlign}`);
  } else pass(`${what}: ${lines.length} line(s) drawn at x=${wantX} with textAlign=${wantAlign}`);
}
// The original band rides along in drawCard at the small size.
const ctxWithBand = makeFakeCtx();
Q.drawCard(ctxWithBand, withOrig, theme, {});
const bandLines = ctxWithBand.calls.fillText.filter((c) => /^400 30px/.test(c.font));
if (!bandLines.length || bandLines[0].text !== ORIG) fail('drawCard did not draw the original band');
else pass('drawCard draws the original band at the small muted size');

// ---- 9. non-ASCII, punctuation and multiline survive layout ---------------
// maxFont is capped so no single token is wider than the column at the drawn
// size: below that threshold the wrapper must preserve every character and
// space exactly (a wider token is hard-split by design, covered next).
const UNICODE = 'Grüße, naïve “quotes” — em-dashes… 日本語のテキスト、かぎ括弧付き！';
const uni = Q.layoutCard(UNICODE, stubMeasure, Object.assign({}, WIDE, { maxFont: 100 }));
if (!uni.lines.length) fail('non-ASCII text produced no lines');
else if (uni.lines.join(' ').replace(/\s+/g, ' ') !== UNICODE) {
  fail(`non-ASCII text was mangled: ${JSON.stringify(uni.lines.join(' '))}`);
} else pass('non-ASCII text lays out unchanged');
const LONG_UNI = 'Ünïcödé'.repeat(80);
const uniHard = Q.layoutCard(LONG_UNI, stubMeasure, WIDE);
if (uniHard.lines.some((x) => stubMeasure(x, uniHard.font) > WIDE.maxWidth)) {
  fail('a long non-ASCII token overflowed the column');
} else pass('long non-ASCII token is hard-split, never overflows');
// wrapParagraph keeps explicit newlines as separate lines (the card's strip
// collapses them first, but the wrapper itself must honour them).
const multi = Q.wrapParagraph('alpha\nbeta', stubMeasure, WIDE.maxWidth, 40);
if (multi.length !== 2 || multi[0] !== 'alpha' || multi[1] !== 'beta') {
  fail(`multiline wrap produced ${JSON.stringify(multi)}`);
} else pass('multiline input wraps as separate lines');

// ---- 10. export dimensions at every device pixel ratio ---------------------
// The fake document stands in for the browser: renderCard must size the buffer
// off the capped ratio, so dpr 3 does not allocate a 50MB canvas.
function makeExportCtx() { return makeFakeCtx(); }
for (const dpr of [1, 2, 3]) {
  const ctx = makeExportCtx();
  sandbox.window = { devicePixelRatio: dpr };
  sandbox.document = {
    createElement() {
      return {
        width: 0, height: 0, style: {},
        getContext: () => ctx,
        toBlob(cb) { cb({ size: 1024, type: 'image/png' }); },
      };
    },
  };
  const expected = Math.min(2, Math.max(1, dpr));
  const r = await Q.renderCard('Hail and well met, friend', 'shakespeare');
  if (r.canvas.width !== Q.CARD_W * expected || r.canvas.height !== Q.CARD_H * expected) {
    fail(`dpr ${dpr}: canvas ${r.canvas.width}x${r.canvas.height}, want ${Q.CARD_W * expected}x${Q.CARD_H * expected}`);
  } else pass(`dpr ${dpr}: canvas is ${r.canvas.width}x${r.canvas.height} (cap ${Q.CARD_DPR_CAP || 2})`);
  if (!ctx.calls.fillText.length) fail(`dpr ${dpr}: renderCard drew no text`);
}
// And a full option set through renderCard end to end.
{
  const ctx = makeExportCtx();
  sandbox.window = { devicePixelRatio: 2 };
  sandbox.document = {
    createElement() {
      return {
        width: 0, height: 0, style: {},
        getContext: () => ctx,
        toBlob(cb) { cb({ size: 1024, type: 'image/png' }); },
      };
    },
  };
  const r = await Q.renderCard('Pie, I like', 'yoda', {
    skin: 'midnight', background: 'flat', align: 'center', original: 'I like pie',
  });
  if (r.theme.ink !== Q.CARD_SKINS.midnight.ink) fail('renderCard ignored the skin option');
  else if (ctx.calls.linear !== 0) fail('renderCard ignored the flat background option');
  else if (ctx.calls.fillText.filter((c) => /italic 400/.test(c.font)).some((c) => c.x !== 540)) {
    fail('renderCard ignored the center align option');
  } else if (!ctx.calls.fillText.some((c) => c.text === 'I like pie')) {
    fail('renderCard ignored the original option');
  } else pass('renderCard honours skin, background, align and original together');
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall quote-card checks passed');
process.exitCode = failures ? 1 : 0;
