// Quote card: strip stage business, lay out text, draw to canvas, export PNG.
//
// This file is the single source of truth. build-dashboard.mjs inlines it into
// the generated index.html verbatim; tools/test-quotecard.mjs loads this same
// file in a sandbox. Plain script (no module syntax) so both work.
//
// Appearance options (all opt-in; the defaults draw the original card):
//   skin       'auto' (the page style's own parchment tints) or one of the
//              CARD_SKINS palettes - parchment, midnight, verdant.
//   background 'gradient' (lit parchment), 'flat' (solid mid colour) or
//              'wash' (light flat + vignette).
//   align      'left', 'center' or 'right' for the quote lines; the opening
//              and closing marks follow the alignment so the group stays
//              balanced. The footer label is always left-aligned.
//   original   the pre-transform input text; when set it is drawn as a small
//              muted band under the quote (max two lines, ellipsis after).

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
const CARD_MARK_INK = 'rgba(196,140,52,0.62)';
const CARD_VIGNETTE = 'rgba(74,52,28,0.10)';
const CARD_QUOTE_FONT = '"Cormorant Garamond", Georgia, serif';
const CARD_LABEL_FONT = 'Cinzel, Georgia, serif';

// The optional original-input band: small, muted, never more than two lines.
const CARD_ORIGINAL_FONT = 30;
const CARD_ORIGINAL_MAX_LINES = 2;
// Breathing room between the quote group and the band's hairline rule.
const CARD_ORIGINAL_GAP = 34;

// Parchment tints copied from each style page's .card gradient. 'auto' skin
// uses these, so every style keeps the identity it has always shipped with.
const CARD_THEMES = {
  shakespeare: { label: 'Shakespeare', from: '#faf3e6', mid: '#f0e4cc', to: '#e8d9b8' },
  pirate:      { label: 'Pirate',      from: '#e8f0e6', mid: '#d8e8d4', to: '#c8dcc2' },
  victorian:   { label: 'Victorian',   from: '#f4eef8', mid: '#e8e0f0', to: '#dcd2e8' },
  chaucer:     { label: 'Chaucer',     from: '#f8f2e0', mid: '#f0e8d0', to: '#e8dec0' },
  yoda:        { label: 'Yoda',        from: '#e8f4e6', mid: '#d8ecd2', to: '#c8e2c2' },
  norse:       { label: 'Norse',       from: '#f0eaf8', mid: '#e4dcf0', to: '#d8d0e8' },
};

// User-selectable skins. Each is a full palette in the same visual family as
// the parchment cards (deep frame, warm accents, muted footer) so no combination
// reads as a different product. Colours are chosen so the quote ink keeps at
// least 4.5:1 contrast against every background stop; tools/test-quotecard.mjs
// enforces that.
const CARD_SKINS = {
  parchment: {
    from: '#faf3e6', mid: '#f0e4cc', to: '#e8d9b8',
    ink: '#3d2b1f', accent: '#d4a056', accentSoft: 'rgba(212,160,86,0.55)',
    labelInk: '#8a6a3a', markInk: 'rgba(196,140,52,0.62)',
    vig: 'rgba(74,52,28,0.10)',
  },
  midnight: {
    from: '#1e2438', mid: '#161c2e', to: '#0e1322',
    ink: '#f0e6d2', accent: '#c9a86a', accentSoft: 'rgba(201,168,106,0.50)',
    labelInk: '#c9b48a', markInk: 'rgba(201,168,106,0.55)',
    vig: 'rgba(0,0,0,0.40)',
  },
  verdant: {
    from: '#eef4e8', mid: '#dfeadb', to: '#d0e0c8',
    ink: '#2c3a26', accent: '#6a8f5a', accentSoft: 'rgba(106,143,90,0.55)',
    labelInk: '#4a6a44', markInk: 'rgba(106,143,90,0.50)',
    vig: 'rgba(40,60,30,0.12)',
  },
};

/**
 * The palette a card draws with. 'auto' (or any unknown id) keeps the page
 * style's own tints with the classic parchment ink, so the default card is
 * unchanged. A named skin overrides the colours but keeps the style label, so
 * a midnight Shakespeare card still signs itself SHAKESPEARE.
 */
function resolveCardSkin(styleId, skinId) {
  const base = CARD_THEMES[styleId] || CARD_THEMES.shakespeare;
  const skin = CARD_SKINS[skinId];
  if (!skin) {
    return {
      label: base.label, from: base.from, mid: base.mid, to: base.to,
      ink: CARD_INK, accent: CARD_ACCENT, accentSoft: CARD_ACCENT_SOFT,
      labelInk: CARD_LABEL_INK, markInk: CARD_MARK_INK, vig: CARD_VIGNETTE,
    };
  }
  return {
    label: base.label, from: skin.from, mid: skin.mid, to: skin.to,
    ink: skin.ink, accent: skin.accent, accentSoft: skin.accentSoft,
    labelInk: skin.labelInk, markInk: skin.markInk, vig: skin.vig,
  };
}

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
 * opts.original, when set, is the pre-transform input: it is wrapped at the
 * small band size, capped at CARD_ORIGINAL_MAX_LINES with an ellipsis, and its
 * block height is subtracted from the quote's budget so the two never overlap.
 *
 * @returns {{lines: string[], font: number, lineHeight: number,
 *            truncated: boolean, warning: null|'long'|'cut',
 *            original: null|{lines: string[], font: number, lineHeight:
 *            number, truncated: boolean, blockHeight: number}}}
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

  // The optional original band, wrapped before the quote so its exact height
  // can be carved out of the quote's budget.
  let original = null;
  const origBody = o.original ? stripStageBusiness(o.original) : '';
  if (origBody) {
    const oFont = CARD_ORIGINAL_FONT;
    const oLineHeight = Math.round(oFont * 1.35);
    let oLines = wrapParagraph(origBody, measure, maxWidth, oFont);
    let oTruncated = false;
    if (oLines.length > CARD_ORIGINAL_MAX_LINES) {
      oLines = oLines.slice(0, CARD_ORIGINAL_MAX_LINES);
      let last = oLines[CARD_ORIGINAL_MAX_LINES - 1];
      while (last.length > 1 && measure(last + '…', oFont) > maxWidth) {
        last = last.slice(0, -1);
      }
      oLines[CARD_ORIGINAL_MAX_LINES - 1] = last.replace(/\s+$/, '') + '…';
      oTruncated = true;
    }
    original = {
      lines: oLines, font: oFont, lineHeight: oLineHeight,
      truncated: oTruncated,
      blockHeight: oLines.length * oLineHeight + CARD_ORIGINAL_GAP,
    };
  }

  const body = stripStageBusiness(text);
  if (!body) {
    return {
      lines: [], font: maxFont, lineHeight: maxFont * ratioFor(maxFont),
      truncated: false, warning: null, original: original,
    };
  }

  // The mark stack drawCard adds around the text: opening mark height, its gap
  // below, the closing gap and the closing mark height.
  const markStack = (font) => font * (0.46 + 0.26 + 0.08 + 0.4);
  const budgetFor = (font) => Math.max(1,
    Math.floor((maxHeight - (original ? original.blockHeight : 0) - markStack(font))
      / (font * ratioFor(font))));

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

  return {
    lines, font, lineHeight: font * ratio, truncated,
    warning: cardWarning({ font, truncated }), original: original,
  };
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
// `theme` is a resolveCardSkin() palette; `opts.background` picks the fill
// mode and `opts.align` the quote alignment. Unknown values fall back to the
// original look.
function drawCard(ctx, layout, theme, opts) {
  const o = opts || {};
  const W = o.width || CARD_W;
  const H = o.height || CARD_H;
  const L = W - CARD_PAD;
  const cx = W / 2;
  const cy = H / 2;
  const align = o.align === 'center' ? 'center' : o.align === 'right' ? 'right' : 'left';
  const lineX = align === 'center' ? cx : align === 'right' ? L : CARD_PAD;
  const bgMode = o.background === 'flat' ? 'flat' : o.background === 'wash' ? 'wash' : 'gradient';

  if (bgMode === 'gradient') {
    // Parchment, lit from the upper left.
    const bg = ctx.createLinearGradient(0, 0, W * 0.55, H);
    bg.addColorStop(0, theme.from);
    bg.addColorStop(0.55, theme.mid);
    bg.addColorStop(1, theme.to);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Very light vignette: enough to warm the corners, not so much that it
    // reads as a spotlight behind the text.
    const vig = ctx.createRadialGradient(cy, cy * 0.9, W * 0.42, cy, cy, H * 0.72);
    vig.addColorStop(0, 'rgba(255,255,255,0.05)');
    vig.addColorStop(0.7, 'rgba(0,0,0,0)');
    vig.addColorStop(1, theme.vig);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  } else {
    // flat and wash share a solid base; wash keeps the vignette for depth.
    ctx.fillStyle = bgMode === 'wash' ? theme.from : theme.mid;
    ctx.fillRect(0, 0, W, H);
    if (bgMode === 'wash') {
      const vig = ctx.createRadialGradient(cy, cy * 0.9, W * 0.42, cy, cy, H * 0.72);
      vig.addColorStop(0, 'rgba(255,255,255,0.05)');
      vig.addColorStop(0.7, 'rgba(0,0,0,0)');
      vig.addColorStop(1, theme.vig);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Gold frame plus a hairline inner rule.
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 5;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.lineWidth = 1.25;
  ctx.strokeRect(44, 44, W - 88, H - 88);

  // Top ornament: a rule broken by a small diamond.
  const oy = 150;
  ctx.strokeStyle = theme.accentSoft;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CARD_PAD + 40, oy);
  ctx.lineTo(cx - 24, oy);
  ctx.moveTo(cx + 24, oy);
  ctx.lineTo(L - 40, oy);
  ctx.stroke();
  ctx.fillStyle = theme.accent;
  ctx.beginPath();
  ctx.moveTo(cx, oy - 11);
  ctx.lineTo(cx + 11, oy);
  ctx.lineTo(cx, oy + 11);
  ctx.lineTo(cx - 11, oy);
  ctx.closePath();
  ctx.fill();

  // Quote group: an oversized opening quote, the text, then a matching closing
  // quote. Both are part of the measured group, so the composition balances as
  // one unit rather than leaving a dead band above or below the text.
  const origReserve = layout.original ? layout.original.blockHeight : 0;
  const zoneBottom = CARD_TEXT_BOTTOM - origReserve;
  const zoneH = zoneBottom - CARD_TEXT_TOP;
  const blockH = layout.lines.length * layout.lineHeight;
  const markSize = Math.round(layout.font * 1.5);
  const markH = layout.font * 0.46;
  const markGap = layout.font * 0.26;
  const closeGap = layout.font * 0.08;
  const closeH = layout.font * 0.4;
  const groupH = markH + markGap + blockH + closeGap + closeH;
  const top = CARD_TEXT_TOP + (zoneH - groupH) / 2 - groupH * 0.03;
  const textTop = top + markH + markGap;

  ctx.textBaseline = 'top';

  // U+201C / U+201D already carry the correct opening and closing shapes, so
  // no rotation is needed. The marks follow the quote's alignment: left cards
  // frame diagonally (top-left to bottom-right), centred cards stack on the
  // axis, right cards mirror the left layout.
  ctx.fillStyle = theme.markInk;
  ctx.font = '400 ' + markSize + 'px ' + CARD_QUOTE_FONT;
  if (align === 'center') {
    ctx.textAlign = 'center';
    ctx.fillText('“', cx, top);
  } else if (align === 'right') {
    ctx.textAlign = 'right';
    ctx.fillText('“', L, top);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText('“', CARD_PAD - 6, top);
  }

  ctx.fillStyle = theme.ink;
  ctx.font = 'italic 400 ' + layout.font + 'px ' + CARD_QUOTE_FONT;
  ctx.textAlign = align;
  for (let i = 0; i < layout.lines.length; i++) {
    ctx.fillText(layout.lines[i], lineX, textTop + i * layout.lineHeight);
  }

  ctx.fillStyle = theme.markInk;
  ctx.font = '400 ' + markSize + 'px ' + CARD_QUOTE_FONT;
  if (align === 'center') {
    ctx.textAlign = 'center';
    ctx.fillText('”', cx, textTop + blockH + closeGap);
  } else if (align === 'right') {
    ctx.textAlign = 'left';
    ctx.fillText('”', CARD_PAD - 6, textTop + blockH + closeGap);
  } else {
    ctx.textAlign = 'right';
    ctx.fillText('”', L, textTop + blockH + closeGap);
  }

  // Optional original-input band: a hairline over small muted non-italic type,
  // pinned to the bottom of the content zone. The quote was laid out around
  // this reservation, so the two can never collide.
  if (origReserve) {
    const band = layout.original;
    const ruleY = zoneBottom + 12;
    ctx.strokeStyle = theme.accentSoft;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(cx - 120, ruleY);
    ctx.lineTo(cx + 120, ruleY);
    ctx.stroke();

    ctx.fillStyle = theme.labelInk;
    ctx.font = '400 ' + band.font + 'px ' + CARD_QUOTE_FONT;
    ctx.textAlign = align;
    const oTop = ruleY + 22;
    for (let i = 0; i < band.lines.length; i++) {
      ctx.fillText(band.lines[i], lineX, oTop + i * band.lineHeight);
    }
  }

  // Footer: a hairline above a letterspaced style name. Always left-aligned:
  // it is a signature, not part of the quoted composition.
  ctx.strokeStyle = theme.accentSoft;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(CARD_PAD, CARD_LABEL_RULE_Y);
  ctx.lineTo(L, CARD_LABEL_RULE_Y);
  ctx.stroke();

  ctx.fillStyle = theme.labelInk;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = '700 26px ' + CARD_LABEL_FONT;
  // Canvas has no letter-spacing in older engines, so track the caps by hand.
  drawTracked(ctx, theme.label.toUpperCase(), CARD_PAD, CARD_LABEL_RULE_Y + 48, 9);

  return {
    font: layout.font, lineHeight: layout.lineHeight,
    truncated: layout.truncated, warning: layout.warning,
    originalTruncated: !!(layout.original && layout.original.truncated),
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

/**
 * Draw a card. `opts` is optional; with none you get the classic card:
 *   {skin: 'auto'|'parchment'|'midnight'|'verdant',
 *    background: 'gradient'|'flat'|'wash',
 *    align: 'left'|'center'|'right',
 *    original: string}   // pre-transform input for the muted band
 */
function renderCard(text, styleId, opts) {
  const o = opts || {};
  const theme = resolveCardSkin(styleId, o.skin);
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
    const layout = layoutCard(text, measure, { original: o.original });
    const meta = drawCard(made.ctx, layout, theme, {
      background: o.background, align: o.align,
    });
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
    CARD_THEMES, CARD_SKINS, CARD_W, CARD_H, CARD_PAD,
    CARD_FONT_MIN, CARD_FONT_MAX, CARD_FONT_LONG,
    CARD_ORIGINAL_FONT, CARD_ORIGINAL_MAX_LINES,
    stripStageBusiness, wrapParagraph, layoutCard, cardWarning, drawCard,
    resolveCardSkin, ensureCardFonts, renderCard, downloadCard,
  };
}
