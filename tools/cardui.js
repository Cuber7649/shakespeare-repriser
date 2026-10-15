// Shared quote-card preview modal wiring.
//
// Kept in its own module rather than inlined into the generator that uses it, so
// the markup, styles and behaviour live in one place. Its markup is
// tools/card-modal.html and its styles are tools/card-modal.css, both read and
// inlined by the build.
//
// The modal carries a small options row (skin, background, alignment, show
// original). Every control re-renders the preview in place; nothing is
// persisted, so each open starts from the classic card.
//
// `themes`/`render`/`download` are injected so this also runs under
// tools/smoke-dashboard.mjs with fakes.

function initCardUI(opts) {
  opts = opts || {};
  var themes = opts.themes || (typeof CARD_THEMES !== 'undefined' ? CARD_THEMES : null);
  var render = opts.render || renderCard;
  var download = opts.download || downloadCard;
  var filenameFor = opts.filenameFor ||
    function (styleId) { return 'repriser-' + (styleId || 'card') + '-card.png'; };
  var emptyMessage = opts.emptyMessage || 'Transform some text first';

  var modal = document.getElementById('cardModal');
  var preview = document.getElementById('cardPreview');
  var noteEl = document.getElementById('cardModalNote');
  var warnEl = document.getElementById('cardModalWarn');
  var cardStatusEl = document.getElementById('cardStatus');
  var closeBtn = document.getElementById('cardClose');
  var downloadBtn = document.getElementById('cardDownload');
  var skinSel = document.getElementById('cardSkin');
  var bgSel = document.getElementById('cardBackground');
  var alignSel = document.getElementById('cardAlign');
  var originalChk = document.getElementById('cardOriginal');

  var lastFocus = null;
  var lastCard = null;
  var lastStyleId = null;
  var lastText = null;
  var lastOriginal = null;

  function focusables() {
    return Array.prototype.slice.call(
      modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
  }

  // Empty select values (the Node harness auto-creates bare stubs) fall back to
  // the defaults, so the classic card is what both the browser and the tests
  // get when nothing has been chosen.
  function currentOpts() {
    return {
      skin: (skinSel && skinSel.value) || 'auto',
      background: (bgSel && bgSel.value) || 'gradient',
      align: (alignSel && alignSel.value) || 'left',
      original: originalChk && originalChk.checked ? lastOriginal : null,
    };
  }

  function paint() {
    if (!lastStyleId || !lastText) return;
    var theme = (themes && themes[lastStyleId]) || (themes && themes.shakespeare) ||
      { label: 'Quote' };
    render(lastText, lastStyleId, currentOpts()).then(function (r) {
      var ctx = preview.getContext('2d');
      ctx.clearRect(0, 0, preview.width, preview.height);
      ctx.drawImage(r.canvas, 0, 0, preview.width, preview.height);
      var warning = r.meta.warning;
      warnEl.hidden = !warning;
      if (warning === 'cut') {
        warnEl.textContent = 'Your text is too long for the card, so the end has been cut short.';
        noteEl.textContent = 'Cut short to fit ' + r.meta.font + 'px text';
      } else if (warning === 'long') {
        warnEl.textContent = 'Your text is long, so it has been shrunk to ' +
          r.meta.font + 'px to fit the card.';
        noteEl.textContent = r.meta.font + 'px text, shrunk to fit';
      } else if (r.meta.originalTruncated) {
        // The original band is capped at two lines with an ellipsis; say so
        // rather than letting the cut pass silently.
        warnEl.hidden = false;
        warnEl.textContent = 'The original text was shortened to two lines to fit its band.';
        noteEl.textContent = r.meta.font + 'px text';
      } else {
        noteEl.textContent = r.meta.font + 'px text';
      }
      lastCard = r;
      cardStatusEl.textContent = warning === 'cut'
        ? theme.label + ' quote card ready, text cut short'
        : theme.label + ' quote card ready';
    }).catch(function () {
      noteEl.textContent = 'Could not draw the card';
      cardStatusEl.textContent = 'Could not draw the card';
    });
  }

  function open(styleId, text, fromEl, originalText) {
    if (!text || !text.trim()) {
      cardStatusEl.textContent = emptyMessage;
      return;
    }
    lastFocus = fromEl || null;
    lastStyleId = styleId;
    lastText = text;
    lastOriginal = originalText || null;
    var theme = (themes && themes[styleId]) || (themes && themes.shakespeare) ||
      { label: 'Quote' };
    noteEl.textContent = 'Drawing a ' + theme.label.toLowerCase() + ' card';
    warnEl.hidden = true;
    modal.hidden = false;
    closeBtn.focus();
    paint();
  }

  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    lastCard = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function isOpen() { return !modal.hidden; }

  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });

  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    var items = focusables();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  });

  // Any option change redraws the preview with the same text. The guard keeps
  // this a no-op when the modal is closed (controls still focusable by tabbing
  // through hidden UI in some browsers).
  function onOptionChange() {
    if (modal.hidden || !lastText) return;
    paint();
  }
  [skinSel, bgSel, alignSel, originalChk].forEach(function (el) {
    if (el && el.addEventListener) el.addEventListener('change', onOptionChange);
  });

  downloadBtn.addEventListener('click', function () {
    if (!lastCard) return;
    download(lastCard.canvas, filenameFor(lastStyleId))
      .then(function (size) {
        cardStatusEl.textContent = 'Card downloaded, ' + Math.round(size / 1024) + ' kilobytes';
      }).catch(function () {
        cardStatusEl.textContent = 'The card could not be saved';
      });
  });

  return { open: open, close: close, isOpen: isOpen };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initCardUI: initCardUI };
}
