// Make Card wiring for the six individual style pages.
//
// Pasted VERBATIM into all six style pages after tools/quotecard.js and
// tools/cardui.js, so the pages stay standalone and the copies cannot drift:
// tools/test-cardpages.mjs fails the build if any page's block differs from
// this file. The dashboard keeps its own copy of this wiring in
// tools/build-dashboard.mjs because it has one button per style reading
// out-<id>, where a style page has one button reading #output.

var cardPageUI = null;

function initCardPage() {
  if (cardPageUI) return cardPageUI;
  if (typeof document === 'undefined' || !document.getElementById) return null;
  var btn = document.getElementById('makeCardBtn');
  if (!btn || typeof btn.addEventListener !== 'function') return null;
  cardPageUI = initCardUI({ emptyMessage: 'Transform some text first' });
  btn.addEventListener('click', function () {
    var out = document.getElementById('output');
    var input = document.getElementById('input');
    var id = btn.getAttribute ? btn.getAttribute('data-card') : null;
    // The original input travels with the output so the modal's "Show original
    // text" option has something to draw.
    cardPageUI.open(id, out ? out.textContent : '', btn, input ? input.value : '');
  });
  return cardPageUI;
}

var cardPage = (typeof document !== 'undefined') ? initCardPage() : null;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initCardPage: initCardPage };
}
