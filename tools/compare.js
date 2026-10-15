// Original/output comparison: a word-level diff view that shows the input
// alongside its transformation.
//
// The pages are standalone -- no shared runtime files -- so this file is pasted
// VERBATIM into all seven of them. tools/test-compare.mjs fails the build if
// any copy drifts: it compares against browserSource() of this file, so the
// CommonJS tail below is the one part that never reaches a page.
//
// The transform reorders sentences, swaps punctuation and inserts whole
// phrases, so a naive word diff would highlight moves as if they were
// rewrites. compareTexts() therefore pairs paragraphs by position and, for
// each pair, measures how much of a real word-level match exists (Dice
// coefficient over the LCS of punctuation-insensitive words). Above the
// threshold the two sides are marked word by word -- moved sentences show as
// a deleted block beside an inserted block, the same convention a code diff
// uses for a move; punctuation-only changes mark nothing. Below the threshold
// the passage is shown plain on both sides with a note, because per-word
// marks there would be noise, not signal. Paragraph breaks survive as
// separate blocks and runs of spaces inside a paragraph collapse to one.

var CMP_MAX_WORDS = 1200;
var CMP_MIN_SIM = 0.35;
var CMP_FALLBACK_NOTE = 'Rewritten too heavily for word-by-word marks; shown plain.';

function cmpEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Matching is case- and punctuation-insensitive so "King," and "king" align;
// the display side keeps each surface form untouched.
function cmpNorm(word) {
  return String(word).toLowerCase().replace(/[^a-z0-9']+/g, '');
}

function cmpWords(text) {
  var flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat ? flat.split(' ') : [];
}

// Longest common subsequence over normalised words. Full DP table, walked
// backwards once at the end; CMP_MAX_WORDS caps the caller so the O(n*m)
// table stays around a megabyte at worst.
function cmpLcs(a, b) {
  var n = a.length;
  var m = b.length;
  var dp = [];
  var i;
  var j;
  for (i = 0; i <= n; i++) {
    var row = new Uint16Array(m + 1);
    if (i > 0) {
      for (j = 1; j <= m; j++) {
        row[j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], row[j - 1]);
      }
    }
    dp.push(row);
  }
  var ops = [];
  i = n;
  j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      ops.push({ t: 'eq', ai: i - 1, bi: j - 1 });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      ops.push({ t: 'del', ai: i - 1 });
      i--;
    } else {
      ops.push({ t: 'ins', bi: j - 1 });
      j--;
    }
  }
  while (i > 0) { ops.push({ t: 'del', ai: i - 1 }); i--; }
  while (j > 0) { ops.push({ t: 'ins', bi: j - 1 }); j--; }
  ops.reverse();
  return ops;
}

// One aligned paragraph: left holds the original view (eq + del), right the
// output view (eq + ins), and sim is the Dice coefficient 2*lcs/(|a|+|b|).
function cmpAlignParagraph(aText, bText) {
  var a = cmpWords(aText);
  var b = cmpWords(bText);
  if (!a.length || !b.length || a.length > CMP_MAX_WORDS || b.length > CMP_MAX_WORDS) {
    return null;
  }
  var ops = cmpLcs(a.map(cmpNorm), b.map(cmpNorm));
  var lcs = 0;
  var left = [];
  var right = [];
  var i;
  for (i = 0; i < ops.length; i++) {
    if (ops[i].t === 'eq') lcs++;
  }
  for (i = 0; i < ops.length; i++) {
    var op = ops[i];
    if (op.t === 'eq') {
      left.push({ t: 'eq', w: a[op.ai] });
      right.push({ t: 'eq', w: b[op.bi] });
    } else if (op.t === 'del') {
      left.push({ t: 'del', w: a[op.ai] });
    } else {
      right.push({ t: 'ins', w: b[op.bi] });
    }
  }
  var sim = (2 * lcs) / (a.length + b.length);
  if (sim < CMP_MIN_SIM) return null;
  return { mode: 'aligned', left: left, right: right, sim: sim };
}

// The readable fallback: both sides plain, no per-word claims.
function cmpPlainParagraph(aText, bText) {
  var left = cmpWords(aText).map(function (w) { return { t: 'plain', w: w }; });
  var right = cmpWords(bText).map(function (w) { return { t: 'plain', w: w }; });
  return { mode: 'fallback', left: left, right: right, sim: 0 };
}

// A paragraph present on only one side is a pure insertion or deletion --
// marking every word there is accurate, not misleading, so it stays aligned.
function cmpOneSidedParagraph(aText, bText, side) {
  var words = cmpWords(side === 'right' ? bText : aText);
  var left = [];
  var right = [];
  for (var i = 0; i < words.length; i++) {
    if (side === 'right') right.push({ t: 'ins', w: words[i] });
    else left.push({ t: 'del', w: words[i] });
  }
  return { mode: 'aligned', left: left, right: right, sim: 0 };
}

function compareTexts(original, transformed) {
  var aRaw = String(original || '');
  var bRaw = String(transformed || '');
  var aParas = aRaw.trim() ? aRaw.split(/\n{2,}/) : [];
  var bParas = bRaw.trim() ? bRaw.split(/\n{2,}/) : [];
  var count = Math.max(aParas.length, bParas.length);
  var paragraphs = [];
  var added = 0;
  var removed = 0;
  var fellBack = false;
  for (var i = 0; i < count; i++) {
    var a = i < aParas.length ? aParas[i] : '';
    var b = i < bParas.length ? bParas[i] : '';
    if (!a.trim() && !b.trim()) continue;
    var para;
    if (!a.trim()) {
      para = cmpOneSidedParagraph(a, b, 'right');
    } else if (!b.trim()) {
      para = cmpOneSidedParagraph(a, b, 'left');
    } else {
      para = cmpAlignParagraph(a, b);
      if (!para) {
        para = cmpPlainParagraph(a, b);
        fellBack = true;
      }
    }
    var j;
    for (j = 0; j < para.left.length; j++) if (para.left[j].t === 'del') removed++;
    for (j = 0; j < para.right.length; j++) if (para.right[j].t === 'ins') added++;
    paragraphs.push(para);
  }
  return {
    paragraphs: paragraphs,
    stats: { added: added, removed: removed, fellBack: fellBack },
  };
}

function cmpRenderSide(tokens) {
  var html = [];
  for (var i = 0; i < tokens.length; i++) {
    var tok = tokens[i];
    var word = cmpEscape(tok.w);
    if (tok.t === 'del') html.push('<del>' + word + '</del>');
    else if (tok.t === 'ins') html.push('<ins>' + word + '</ins>');
    else html.push(word);
  }
  return html.join(' ');
}

function cmpRenderParagraph(para, side) {
  var tokens = side === 'right' ? para.right : para.left;
  return '<p class="cmp-para' + (para.mode === 'fallback' ? ' cmp-para-plain' : '') + '">'
    + cmpRenderSide(tokens) + '</p>';
}

function renderCompare(original, transformed) {
  var diff = compareTexts(original, transformed);
  var leftHtml = [];
  var rightHtml = [];
  for (var i = 0; i < diff.paragraphs.length; i++) {
    leftHtml.push(cmpRenderParagraph(diff.paragraphs[i], 'left'));
    rightHtml.push(cmpRenderParagraph(diff.paragraphs[i], 'right'));
  }
  var note = diff.stats.fellBack
    ? '<p class="cmp-note">' + cmpEscape(CMP_FALLBACK_NOTE) + '</p>'
    : '';
  return '<div class="cmp-grid">'
    + '<div class="cmp-col"><div class="cmp-label">Original</div>'
    + '<div class="cmp-text">' + leftHtml.join('') + '</div></div>'
    + '<div class="cmp-col"><div class="cmp-label">Repraised</div>'
    + '<div class="cmp-text">' + rightHtml.join('') + '</div></div>'
    + '</div>' + note;
}

function cmpEmptyMessage(original, transformed) {
  if (!String(original || '').trim()) return 'Enter some text to compare.';
  if (!String(transformed || '').trim()) return 'Transform some text first.';
  return '';
}

// One panel per output region, created on first toggle and reused after; the
// button flips it and tracks aria-expanded. The original is always the shared
// #input, which is what produced the output on every page.
function cmpToggle(btn) {
  var targetId = btn.getAttribute('data-compare');
  if (!targetId) return false;
  var out = document.getElementById(targetId);
  var inputEl = document.getElementById('input');
  if (!out || !inputEl) return false;
  var panel = document.getElementById('cmp-panel-' + targetId);
  var expanded = btn.getAttribute('aria-expanded') === 'true';
  if (expanded && panel) {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    return false;
  }
  var original = inputEl.value;
  var transformed = out.textContent;
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cmp-panel-' + targetId;
    panel.className = 'cmp';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Original and repraised text compared');
    if (!out.parentNode) return false;
    out.parentNode.insertBefore(panel, out.nextSibling);
  }
  var empty = cmpEmptyMessage(original, transformed);
  panel.innerHTML = empty
    ? '<p class="cmp-note">' + cmpEscape(empty) + '</p>'
    : renderCompare(original, transformed);
  panel.hidden = false;
  btn.setAttribute('aria-controls', panel.id);
  btn.setAttribute('aria-expanded', 'true');
  return true;
}

function initCompareUI() {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return null;
  var buttons = document.querySelectorAll('[data-compare]');
  for (var i = 0; i < buttons.length; i++) {
    (function (btn) {
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', function () { cmpToggle(btn); });
    })(buttons[i]);
  }
  return buttons.length;
}

var compareUI = (typeof document !== 'undefined') ? initCompareUI() : null;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    compareTexts: compareTexts,
    renderCompare: renderCompare,
    cmpToggle: cmpToggle,
    initCompareUI: initCompareUI,
  };
}
