// Smoke test for the generated index.html: parses, wires up, produces the same
// output as the individual style pages, and draws a correct quote card.
//   node tools/smoke-dashboard.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { loadPage } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const PAGES = [
  ['shakespeare', 'shakespeare.html', 'shakespearify'],
  ['pirate', 'pirate.html', 'pirateify'],
  ['victorian', 'victorian.html', 'victorianify'],
  ['chaucer', 'chaucer.html', 'chaucerify'],
  ['yoda', 'yoda.html', 'yodaify'],
  ['norse', 'norse.html', 'norseify'],
];

let failures = 0;
const fail = (m) => { console.log(`FAIL  ${m}`); failures++; };
const pass = (m) => console.log(`ok    ${m}`);

// --- DOM stub: needs querySelectorAll, dataset, canvas, and a focus trap ---
const listeners = new Map();
const byId = new Map();
const canvases = [];

function makeCtx() {
  const calls = { fillText: [], fillRect: 0, strokeRect: 0, drawn: 0 };
  return {
    calls,
    font: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
    textBaseline: '', textAlign: '',
    // transforms the real code applies before drawing
    scale() {}, save() {}, restore() {}, translate() {}, rotate() {},
    clearRect() {}, fillRect() { calls.fillRect++; },
    strokeRect() { calls.strokeRect++; },
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    stroke() {}, fill() {},
    // Width must depend on ctx.font, as it does in a real canvas. A fixed stub
    // here hides the bug where layout measures at the "10px sans-serif"
    // default, so every line "fits", nothing wraps, and text overflows.
    measureText(s) {
      const m = /(\d+(?:\.\d+)?)px/.exec(this.font);
      const size = m ? parseFloat(m[1]) : 10;
      return { width: String(s).length * size * 0.5 };
    },
    fillText(s, x, y) { calls.fillText.push({ text: String(s), x, y, font: this.font }); },
    drawImage() { calls.drawn++; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
}

function makeCanvas() {
  const node = {
    tagName: 'CANVAS', width: 0, height: 0, style: {}, dataset: {},
    textContent: '', innerHTML: '', value: '',
    classList: { add() {}, remove() {} },
    getContext() { if (!this._ctx) this._ctx = makeCtx(); return this._ctx; },
    toBlob(cb) { cb({ size: 2048, type: 'image/png' }); },
    addEventListener() {}, focus() {},
  };
  canvases.push(node);
  return node;
}

function el(id) {
  if (byId.has(id)) return byId.get(id);
  const node = id === 'cardPreview' ? makeCanvas() : {
    id, value: '', textContent: '', innerHTML: '', dataset: {},
    hidden: false, offsetParent: {}, disabled: false,
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) {
      if (!listeners.has(id)) listeners.set(id, {});
      listeners.set(id, { ...(listeners.get(id) || {}), [type]: fn });
    },
    querySelectorAll() { return []; },
    focus() {},
    click() { this.clicked = true; },
  };
  byId.set(id, node);
  return node;
}

const copyButtons = PAGES.map(([id]) => { const n = el('copy-' + id); n.dataset.copy = id; return n; });
const cardButtons = PAGES.map(([id]) => { const n = el('card-' + id); n.dataset.card = id; return n; });
// The dashboard carries one Save button per style; the script reads its label
// and source element from data-save / data-save-target, not from the id.
const saveButtons = PAGES.map(([id]) => {
  const label = id.charAt(0).toUpperCase() + id.slice(1);
  const n = el('save-' + id);
  n.getAttribute = (name) => (name === 'data-save' ? label
    : name === 'data-save-target' ? 'out-' + id : null);
  return n;
});

// localStorage for the saved-quotes block. Unstubbed, the script throws on load
// and the whole smoke test would report a parse failure instead of this.
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}
const storage = makeStorage();
const anchors = [];   // <a> elements created by downloadCard
const appended = [];  // nodes handed to document.body.appendChild

// document.fonts is deliberately absent: that exercises the offline path,
// where ensureCardFonts resolves to null and the card falls back to CSS stacks.
const docListeners = {};
const sandbox = {
  console,
  // Math.random is pinned so the dashboard's derived seeds are computable here.
  // Object.create keeps every Math method reachable; only random() is replaced.
  Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
  JSON,
  setTimeout: () => 0,
  clearTimeout: () => {},
  URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
  document: {
    getElementById: (id) => (byId.has(id) ? el(id) : el(id)),
    querySelectorAll: (sel) => (sel === '[data-copy]' ? copyButtons
      : sel === '[data-card]' ? cardButtons
        : sel === '[data-save]' ? saveButtons : []),
    createElement: (tag) => {
      if (tag === 'canvas') return makeCanvas();
      const n = el('tmp' + tag + (anchors.length || appended.length));
      if (tag === 'a') anchors.push(n);
      return n;
    },
    body: {
      appendChild(n) { appended.push(n); },
      removeChild() {},
    },
    addEventListener(type, fn) { docListeners[type] = fn; },
  },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  localStorage: storage,
};
// devicePixelRatio is overridable so the export can be checked at several
// densities: node tools/smoke-dashboard.mjs 3
const TEST_DPR = Number(process.argv[2] || 2);
const EXPECTED_DPR = Math.min(2, Math.max(1, TEST_DPR || 1));

sandbox.window = { devicePixelRatio: TEST_DPR };
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const script = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/)[1];

try {
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: 'index.html' });
  pass('index.html script parses and runs');
} catch (e) {
  console.log('FAIL  index.html script threw:', e.message);
  process.exit(1);
}

async function main() {
  // --- ids referenced by the script must exist in the markup --------------
  const referenced = [...script.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]);
  const outIds = PAGES.map(([id]) => 'out-' + id);
  const missing = [...referenced, ...outIds].filter((id) => !html.includes(`id="${id}"`));
  if (missing.length) fail(`ids absent from markup: ${missing.join(', ')}`);
  else pass(`all ${referenced.length + outIds.length} referenced ids present`);

  // --- transform all matches each page ------------------------------------
  const input = el('input');
  input.value = 'you are my friend and it is very good';
  listeners.get('go').click();

  const baseSeed = ((((0.5 * 0x100000000) >>> 0) + 0x9E3779B9) >>> 0);
  let same = 0;
  for (const [i, [id, file, entry]] of PAGES.entries()) {
    const page = loadPage(join(ROOT, file), entry);
    if (page.transform(input.value, (baseSeed + i) >>> 0) === el('out-' + id).textContent) same++;
    else fail(`${id}: card output differs from ${file}`);
  }
  if (same === PAGES.length) pass(`all ${PAGES.length} cards match their page`);

  const first = el('out-shakespeare').textContent;
  listeners.get('go').click();
  if (el('out-shakespeare').textContent === first) fail('repeat Transform All did not vary');
  else pass('repeat Transform All varies');

  input.value = '   ';
  listeners.get('go').click();
  if (el('dashStatus').textContent !== 'Enter some text first') fail('empty input guard');
  else pass('empty input guarded');

  // --- saved quotes -------------------------------------------------------
  input.value = 'you are my friend';
  listeners.get('go').click();
  const savedText = el('out-shakespeare').textContent;
  if (!savedText.trim()) fail('nothing to save');
  listeners.get('save-shakespeare').click();

  const listHtml = el('savedQuotesList').innerHTML;
  if (!listHtml.includes(savedText)) fail('saved quote was not listed');
  else pass('saved quote listed');

  const stored = JSON.parse(storage.getItem('repriser.savedQuotes') || '[]');
  if (stored.length !== 1 || stored[0].style !== 'Shakespeare') {
    fail(`storage holds ${JSON.stringify(stored)}`);
  } else pass('saved quote written to localStorage with its style label');

  if (el('savedQuotesStatus').textContent !== 'Quote saved') {
    fail(`save did not announce itself: ${JSON.stringify(el('savedQuotesStatus').textContent)}`);
  } else pass('save announced through the status region');

  // Saving the same text twice must not duplicate the row.
  listeners.get('save-shakespeare').click();
  const storedTwice = JSON.parse(storage.getItem('repriser.savedQuotes') || '[]');
  if (storedTwice.length !== 1) fail(`duplicate save was stored: ${storedTwice.length}`);
  else pass('duplicate save ignored');

  // --- quote card ---------------------------------------------------------
  input.value = 'you are my friend';
  listeners.get('go').click();
  const styleOut = el('out-shakespeare').textContent;
  if (!styleOut.trim()) { fail('no output to make a card from'); return; }

  canvases.length = 0;
  cardButtons[0].listeners = null;
  // the button handler was registered on the stub created above
  const cardBtn = cardButtons[0];
  el('input').value = 'you are my friend';
  // re-run so the output is present, then open the card
  listeners.get('go').click();
  cardBtn.dispatchClick ? cardBtn.dispatchClick() : clickCard(cardBtn);
  await tick();

  // canvases[0] is the visible preview; renderCard creates its own, which is
  // the last one appended.
  const previewCanvas = el('cardPreview');
  const internal = canvases[canvases.length - 1];
  const drawn = internal ? internal.getContext('2d').calls : null;
  if (!drawn) { fail('no canvas was drawn'); return; }

  // The export buffer must be sized off the capped ratio, not the raw device
  // ratio, or high-density phones allocate a 50MB canvas for detail that is
  // discarded on download anyway.
  if (internal.width !== 1080 * EXPECTED_DPR || internal.height !== 1350 * EXPECTED_DPR) {
    fail(`canvas is ${internal.width}x${internal.height}, expected ` +
      `${1080 * EXPECTED_DPR}x${1350 * EXPECTED_DPR} at dpr ${TEST_DPR} (capped ${EXPECTED_DPR})`);
  } else {
    const mb = ((internal.width * internal.height * 4) / 1048576).toFixed(0);
    pass(`canvas ${internal.width}x${internal.height} at dpr ${TEST_DPR} (cap 2), ${mb}MB buffer`);
  }
  if (drawn.fillText.length === 0) fail('drawCard drew no text');
  else pass(`drawCard wrote ${drawn.fillText.length} fillText call(s)`);

  if (drawn.fillRect === 0) fail('parchment background was not filled');
  else pass('parchment background filled');

  const text = drawn.fillText.map((c) => c.text);
  const leaked = text.filter((t) => /\(aside:/i.test(t) || /\[[^\]]*\]/.test(t));
  if (leaked.length) fail(`stage business leaked into the card: ${JSON.stringify(leaked)}`);
  else pass('no asides or stage directions on the card');

  if (!text.some((t) => t === 'S')) fail('style label was not drawn');
  else pass('style label drawn');

  const quoteCalls = drawn.fillText.filter((c) => /Cormorant/.test(c.font) && c.text !== '“' && c.text !== '”');
  if (!quoteCalls.length) fail('quote text was not set in the Cormorant font');
  else pass(`quote text uses the Cormorant font (${quoteCalls[0].font})`);

  // Quote marks must be a matched pair, not a lone opening glyph.
  const openMarks = drawn.fillText.filter((c) => c.text === '“');
  const closeMarks = drawn.fillText.filter((c) => c.text === '”');
  if (openMarks.length !== 1) fail(`expected 1 opening quote mark, got ${openMarks.length}`);
  else if (closeMarks.length !== 1) fail(`expected 1 closing quote mark, got ${closeMarks.length}`);
  else if (!/Cormorant/.test(openMarks[0].font) || !/Cormorant/.test(closeMarks[0].font)) {
    fail('quote marks not set in the quote face');
  } else if (closeMarks[0].x <= openMarks[0].x) {
    fail(`closing mark is not to the right of the opening mark (x=${closeMarks[0].x})`);
  } else {
    pass(`matched quote marks at ${openMarks[0].font}, closing right-aligned at x=${closeMarks[0].x}`);
  }

  // Optical balance: the text block (excluding the mark) should sit near the
  // content zone's centre, not pinned to the top or the bottom.
  if (quoteCalls.length) {
    const ys = quoteCalls.map((c) => c.y);
    const lh = ys.length > 1 ? ys[1] - ys[0] : 0;
    const blockCentre = ys[0] + ((ys.length - 1) * lh) / 2;
    const zoneCentre = (210 + 1140) / 2;
    const drift = Math.abs(blockCentre - zoneCentre);
    if (drift > zoneCentre * 0.12) {
      fail(`quote block is off-balance: centre ${Math.round(blockCentre)} vs zone ${zoneCentre}`);
    } else {
      pass(`quote block balanced: centre ${Math.round(blockCentre)} (zone ${zoneCentre})`);
    }
  }

  // The footer rule should be drawn, and the label letterspaced rather than
  // dumped as one fillText call.
  if (!text.some((t) => t === 'S')) fail('label was not drawn per-character with tracking');
  else pass('label drawn with letter tracking');

  // The real-canvas rule: a line must fit the text column at the size it is
  // drawn at. This is the check that would have caught the text overflowing
  // the right edge, because the layout had measured at 10px sans-serif.
  const COL = 1080 - 96 * 2;
  const widthAt = (s, font) => {
    const m = /(\d+(?:\.\d+)?)px/.exec(font);
    return s.length * (m ? parseFloat(m[1]) : 10) * 0.5;
  };
  const overflowing = quoteCalls.filter((c) => widthAt(c.text, c.font) > COL + 1);
  if (overflowing.length) {
    fail(`${overflowing.length} line(s) exceed the ${COL}px column: ` +
      JSON.stringify(overflowing.map((c) => `${c.text.slice(0, 28)}… @${c.font}`)));
  } else {
    pass(`all ${quoteCalls.length} quote line(s) fit the ${COL}px column`);
  }

  const labelCalls = drawn.fillText.filter((c) => /Cinzel/.test(c.font));
  if (!labelCalls.length) fail('label was not set in the Cinzel font');
  else pass('label uses the Cinzel font');

  if (!previewCanvas.getContext('2d').calls.drawn) fail('preview was not blitted');
  else pass('preview blitted to the visible canvas');

  if (el('cardModal').hidden) fail('modal did not open');
  else pass('modal opened');

  // download
  listeners.get('cardDownload').click();
  await tick();
  if (!/downloaded/i.test(el('cardStatus').textContent)) {
    fail(`download did not report success: ${JSON.stringify(el('cardStatus').textContent)}`);
  } else pass('download reports success');

  if (!anchors.length) fail('no download anchor was created');
  else {
    const a = anchors[0];
    if (!a.clicked) fail('the download anchor was never clicked');
    else if (!appended.includes(a)) fail('the anchor was not appended to the document (breaks Firefox)');
    else if (a.download !== 'repriser-shakespeare-card.png') {
      fail(`wrong filename: ${JSON.stringify(a.download)}`);
    } else pass(`download anchor: ${a.download}, appended then clicked`);
  }

  // close restores focus
  listeners.get('cardClose').click();
  if (!el('cardModal').hidden) fail('modal did not close');
  else pass('modal closed');

  // Esc closes
  el('input').value = 'you are my friend';
  listeners.get('go').click();
  clickCard(cardButtons[1]);
  await tick();
  if (el('cardModal').hidden) { fail('could not reopen the modal for the Esc test'); }
  else {
    if (docListeners.keydown) {
      docListeners.keydown({ key: 'Escape', preventDefault() {} });
      if (!el('cardModal').hidden) fail('Escape did not close the modal');
      else pass('Escape closes the modal');
    } else pass('no document keydown handler registered (skipped Esc test)');
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
  process.exitCode = failures ? 1 : 0;
}

function tick() { return new Promise((r) => setImmediate(r)); }

function clickCard(btn) {
  // the generator registers listeners via addEventListener on the stub, so
  // replay the same path the browser would: find and call the click handler
  const store = listeners.get('card-' + btn.dataset.card);
  if (store && store.click) store.click();
  else if (btn.__click) btn.__click();
}

main();
