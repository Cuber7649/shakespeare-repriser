// Quote card: strip stage business, lay out text, draw to canvas, export PNG.
//
// This file is the single source of truth. build-dashboard.mjs inlines it into
// the generated index.html verbatim; tools/test-quotecard.mjs loads this same
// file in a sandbox. Plain script (no module syntax) so both work.

const CARD_W = 1080;
const CARD_H = 1350;
const CARD_PAD = 96;
// Content zone between the top ornament and the footer rule. The quote is
// balanced inside this, not the whole card, so it sits optically centred.
const CARD_TEXT_TOP = 210;
const CARD_TEXT_BOTTOM = 1140;
const CARD_FONT_MIN = 30;
const CARD_FONT_MAX = 120;
// At or below this size the text still fits, but it is no longer comfortable to
// read: the preview says so instead of silently shipping a wall of small type.
const CARD_FONT_LONG = 60;
const CARD_LABEL_RULE_Y = 1188;
const CARD_ACCENT = '#d4a056';
const CARD_ACCENT_SOFT = 'rgba(212,160,86,0.55)';
const CARD_INK = '#3d2b1f';
const CARD_LABEL_INK = '#8a6a3a';
const CARD_QUOTE_FONT = '"Cormorant Garamond", Georgia, serif';
const CARD_LABEL_FONT = 'Cinzel, Georgia, serif';

// Parchment tints copied from each style page's .card gradient.
const CARD_THEMES = {
  shakespeare: { label: 'Shakespeare', from: '#faf3e6', mid: '#f0e4cc', to: '#e8d9b8' },
  pirate:      { label: 'Pirate',      from: '#e8f0e6', mid: '#d8e8d4', to: '#c8dcc2' },
  victorian:   { label: 'Victorian',   from: '#f4eef8', mid: '#e8e0f0', to: '#dcd2e8' },
  chaucer:     { label: 'Chaucer',     from: '#f8f2e0', mid: '#f0e8d0', to: '#e8dec0' },
  yoda:        { label: 'Yoda',        from: '#e8f4e6', mid: '#d8ecd2', to: '#c8e2c2' },
  norse:       { label: 'Norse',       from: '#f0eaf8', mid: '#e4dcf0', to: '#d8d0e8' },
};

// Removes asides and stage directions, then tidies the whitespace they leave
// behind. Deliberately generic: a pattern approach matches any phrase added
// later, where a hardcoded literal list would silently miss it.
function stripStageBusiness(text) {
  return String(text)
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\(aside:[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Greedy word wrap for one paragraph. A single word wider than the column is
// hard-split by character so it can never overflow.
function wrapParagraph(para, measure, maxWidth, font) {
  const out = [];
  for (const rawLine of String(para).split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const words = line.split(/\s+/).filter(Boolean);
    let cur = '';
    for (let word of words) {
      let candidate = cur ? cur + ' ' + word : word;
      if (measure(candidate, font) <= maxWidth) {
        cur = candidate;
        continue;
      }
      if (cur) {
        out.push(cur);
        cur = '';
      }
      while (measure(word, font) > maxWidth && word.length > 1) {
        let cut = word.length;
        while (cut > 1 && measure(word.slice(0, cut), font) > maxWidth) cut--;
        out.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      cur = word;
    }
    if (cur) out.push(cur);
  }
  return out;
}

/**
 * Pure layout. `measure(text, font) -> width` is injected so this is testable
 * in Node with no canvas.
 *
 * Fits the whole quote group, not just the text block: drawCard centres the
 * opening mark, the lines and the closing mark together, so the budget must
 * reserve that mark stack or a full card pushes text up into the top ornament.
 *
 * @returns {{lines: string[], font: number, lineHeight: number,
 *            truncated: boolean, warning: null|'long'|'cut'}}
 */
function layoutCard(text, measure, opts) {
  const o = opts || {};
  const maxWidth = o.maxWidth != null ? o.maxWidth : CARD_W - CARD_PAD * 2;
  const maxHeight = o.maxHeight != null ? o.maxHeight
    : CARD_TEXT_BOTTOM - CARD_TEXT_TOP;
  const minFont = o.minFont != null ? o.minFont : CARD_FONT_MIN;
  const maxFont = o.maxFont != null ? o.maxFont : CARD_FONT_MAX;

  // Display type needs proportionally tighter leading than body copy.
  const ratioFor = (font) => (font >= 100 ? 1.14 : font >= 72 ? 1.2 : font >= 48 ? 1.3 : 1.42);

  const body = stripStageBusiness(text);
  if (!body) {
    return {
      lines: [], font: maxFont, lineHeight: maxFont * ratioFor(maxFont),
      truncated: false, warning: null,
    };
  }

  // The mark stack drawCard adds around the text: opening mark height, its gap
  // below, the closing gap and the closing mark height.
  const markStack = (font) => font * (0.46 + 0.26 + 0.08 + 0.4);
  const budgetFor = (font) => Math.max(1,
    Math.floor((maxHeight - markStack(font)) / (font * ratioFor(font))));

  const wrapAt = (font) => wrapParagraph(body, measure, maxWidth, font);
  const fits = (font) => wrapAt(font).length <= budgetFor(font);

  // Largest size that fits, by binary search: short quotes therefore render
  // large and fill the card, long ones shrink before anything is dropped.
  let font = maxFont;
  let lines;
  if (fits(font)) {
    lines = wrapAt(font);
  } else {
    let lo = minFont;
    let hi = font;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(mid)) lo = mid;
      else hi = mid - 1;
    }
    font = lo;
    lines = wrapAt(font);
  }

  // Still too tall at the minimum size: drop the overflow and mark the cut.
  // CARD_FONT_MIN is the readability floor — the text is never shrunk past it,
  // so the honest options are a small type size or an explicit ellipsis.
  const ratio = ratioFor(font);
  const budget = budgetFor(font);
  let truncated = false;
  if (lines.length > budget) {
    lines = lines.slice(0, budget);
    let last = lines[budget - 1] || '';
    while (last.length > 1 && measure(last + '…', font) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[budget - 1] = last.replace(/\s+$/, '') + '…';
    truncated = true;
  }

  return { lines, font, lineHeight: font * ratio, truncated, warning: cardWarning({ font, truncated }) };
}

/**
 * What the preview should tell the user about this layout.
 *   'cut' - text was longer than the card can hold even at the floor size
 *   'long'- everything fit, but only by shrinking to an uncomfortable size
 *   null  - fits comfortably
 */
function cardWarning(layout) {
  if (!layout) return null;
  if (layout.truncated) return 'cut';
  if (layout.font <= CARD_FONT_LONG) return 'long';
  return null;
}

// Canvas primitives only, so nothing external is loaded and the canvas is never
// tainted (text, fills and strokes), which keeps toBlob/export working.
function drawCard(ctx, layout, theme, opts) {
  const o = opts || {};
  const W = o.width || CARD_W;
  const H = o.height || CARD_H;
  const L = W - CARD_PAD;
  const cy = H / 2;

  // Parchment, lit from the upper left.
  const bg = ctx.createLinearGradient(0, 0, W * 0.55, H);
  bg.addColorStop(0, theme.from);
  bg.addColorStop(0.55, theme.mid);
  bg.addColorStop(1, theme.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Very light vignette: enough to warm the corners, not so much that it reads
  // as a spotlight behind the text.
  const vig = ctx.createRadialGradient(cy, cy * 0.9, W * 0.42, cy, cy, H * 0.72);
  vig.addColorStop(0, 'rgba(255,255,255,0.05)');
  vig.addColorStop(0.7, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(74,52,28,0.10)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Gold frame plus a hairline inner rule.
  ctx.strokeStyle = CARD_ACCENT;
  ctx.lineWidth = 5;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.lineWidth = 1.25;
  ctx.strokeRect(44, 44, W - 88, H - 88);

  // Top ornament: a rule broken by a small diamond.
  const oy = 150;
  ctx.strokeStyle = CARD_ACCENT_SOFT;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CARD_PAD + 40, oy);
  ctx.lineTo(cy - 24, oy);
  ctx.moveTo(cy + 24, oy);
  ctx.lineTo(L - 40, oy);
  ctx.stroke();
  ctx.fillStyle = CARD_ACCENT;
  ctx.beginPath();
  ctx.moveTo(cy, oy - 11);
  ctx.lineTo(cy + 11, oy);
  ctx.lineTo(cy, oy + 11);
  ctx.lineTo(cy - 11, oy);
  ctx.closePath();
  ctx.fill();

  // Quote group: an oversized opening quote, the text, then a matching closing
  // quote. Both are part of the measured group, so the composition balances as
  // one unit rather than leaving a dead band above or below the text.
  const zoneH = CARD_TEXT_BOTTOM - CARD_TEXT_TOP;
  const blockH = layout.lines.length * layout.lineHeight;
  const markSize = Math.round(layout.font * 1.5);
  const markH = layout.font * 0.46;
  const markGap = layout.font * 0.26;
  const closeGap = layout.font * 0.08;
  const closeH = layout.font * 0.4;
  const groupH = markH + markGap + blockH + closeGap + closeH;
  const top = CARD_TEXT_TOP + (zoneH - groupH) / 2 - groupH * 0.03;
  const textTop = top + markH + markGap;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // U+201C / U+201D already carry the correct opening and closing shapes, so
  // no rotation is needed.
  ctx.fillStyle = 'rgba(196,140,52,0.62)';
  ctx.font = '400 ' + markSize + 'px ' + CARD_QUOTE_FONT;
  ctx.fillText('“', CARD_PAD - 6, top);

  ctx.fillStyle = CARD_INK;
  ctx.font = 'italic 400 ' + layout.font + 'px ' + CARD_QUOTE_FONT;
  for (let i = 0; i < layout.lines.length; i++) {
    ctx.fillText(layout.lines[i], CARD_PAD, textTop + i * layout.lineHeight);
  }

  ctx.fillStyle = 'rgba(196,140,52,0.62)';
  ctx.font = '400 ' + markSize + 'px ' + CARD_QUOTE_FONT;
  ctx.textAlign = 'right';
  ctx.fillText('”', L, textTop + blockH + closeGap);

  // Footer: a hairline above a letterspaced style name.
  ctx.strokeStyle = CARD_ACCENT_SOFT;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(CARD_PAD, CARD_LABEL_RULE_Y);
  ctx.lineTo(L, CARD_LABEL_RULE_Y);
  ctx.stroke();

  ctx.fillStyle = CARD_LABEL_INK;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = '700 26px ' + CARD_LABEL_FONT;
  // Canvas has no letter-spacing in older engines, so track the caps by hand.
  drawTracked(ctx, theme.label.toUpperCase(), CARD_PAD, CARD_LABEL_RULE_Y + 48, 9);

  return {
    font: layout.font, lineHeight: layout.lineHeight,
    truncated: layout.truncated, warning: layout.warning,
  };
}

// Manual letter spacing, so the label reads as a considered small-caps line
// rather than a bare word in the corner.
function drawTracked(ctx, text, x, y, track) {
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + track;
  }
  return cx - track - x;
}

// Fonts must be resolved before drawing or canvas silently substitutes a
// fallback serif. Resolves to null rather than rejecting when offline.
function ensureCardFonts() {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve(null);
  const wanted = [
    'italic 400 48px "Cormorant Garamond"',
    '700 26px Cinzel',
  ];
  return Promise.all(
    wanted.map(function (spec) {
      try { return document.fonts.load(spec); } catch (e) { return Promise.resolve([]); }
    })
  )
    .then(function () { return document.fonts.ready; })
    .then(function () { return true; })
    .catch(function () { return null; });
}

const CARD_DPR_CAP = 2;

function makeCardCanvas() {
  const canvas = document.createElement('canvas');
  // Capped at 2: the card is nominally 1080x1350, so a 2x buffer is already
  // double that and stays sharp, while a 3x buffer is 13.1M pixels (~50MB) for
  // detail that every viewer and social platform discards anyway. The cap keeps
  // the export viable on high-density phones.
  const dpr = Math.min(CARD_DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = CARD_W * dpr;
  canvas.height = CARD_H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas: canvas, ctx: ctx, dpr: dpr };
}

function renderCard(text, styleId) {
  const theme = CARD_THEMES[styleId] || CARD_THEMES.shakespeare;
  return ensureCardFonts().then(function () {
    const made = makeCardCanvas();
    // measureText reflects whatever ctx.font is currently set to, and the canvas
    // default is "10px sans-serif". Setting the font here rather than relying on
    // drawCard means every measurement is taken at the size it will be drawn at;
    // otherwise nothing wraps and every line silently overflows the card.
    const measure = function (s, f) {
      made.ctx.font = 'italic 400 ' + f + 'px ' + CARD_QUOTE_FONT;
      return made.ctx.measureText(s).width;
    };
    const layout = layoutCard(text, measure, {});
    const meta = drawCard(made.ctx, layout, theme, {});
    return { canvas: made.canvas, layout: layout, theme: theme, meta: meta };
  });
}

// The anchor must be in the document before click() and the object URL must
// outlive the call, or Firefox and Safari cancel the download.
function downloadCard(canvas, filename) {
  return new Promise(function (resolve, reject) {
    canvas.toBlob(function (blob) {
      if (!blob) { reject(new Error('canvas produced no blob')); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      resolve(blob.size);
    }, 'image/png');
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CARD_THEMES, CARD_W, CARD_H, CARD_PAD,
    CARD_FONT_MIN, CARD_FONT_MAX, CARD_FONT_LONG,
    stripStageBusiness, wrapParagraph, layoutCard, cardWarning, drawCard,
    ensureCardFonts, renderCard, downloadCard,
  };
}
