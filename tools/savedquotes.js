// Saved quotes: a localStorage-backed list of saved outputs, shared by the
// dashboard and the six style pages.
//
// The pages are standalone -- no shared runtime files -- so this file is pasted
// VERBATIM into all seven of them. tools/test-savedquotes.mjs fails the build if
// any copy drifts: it compares against browserSource() of this file, so the
// CommonJS tail below is the one part that never reaches a page.
//
// Storage is best-effort. file:// browsing and privacy modes can refuse
// localStorage outright, so every access is guarded and, when storage is
// refused, the list lives for the session only and the UI says so.

var SQ_KEY = 'repriser.savedQuotes';
var SQ_MAX = 50;
var SQ_EXCERPT = 90;
var SQ_UNAVAILABLE = 'Saving is unavailable in this browser';

// The list itself: [{ text, style, at }], newest first. Storage mirrors it and
// is never the source of truth for an in-flight change.
var sqItems = [];
var sqAvailable = true;
var sqUI = null;

function sqEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sqExcerpt(text, limit) {
  var flat = String(text).replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  return flat.slice(0, limit - 1).replace(/\s+\S*$/, '') + '\u2026';
}

// localStorage throws in Safari's private mode and in some file:// contexts,
// and reading the property itself can throw, so the whole probe is guarded.
function sqStore() {
  try {
    var store = (typeof window !== 'undefined' && window.localStorage) ||
      (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return null;
    var probe = '__repriser_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch (e) {
    return null;
  }
}

// Trims, de-duplicates on text and enforces SQ_MAX, in that order. The key is
// prefixed so a quote that happens to be called "constructor" still dedupes.
function sqNormalise(items) {
  var seen = {};
  var out = [];
  for (var i = 0; i < items.length && out.length < SQ_MAX; i++) {
    var item = items[i];
    if (!item || typeof item.text !== 'string') continue;
    var text = item.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    var key = '@' + text;
    if (seen[key]) continue;
    seen[key] = true;
    out.push({
      text: text,
      style: typeof item.style === 'string' && item.style ? item.style : 'Quote',
      at: typeof item.at === 'number' ? item.at : 0,
    });
  }
  return out;
}

function sqWrite(items) {
  var store = sqStore();
  if (!store) {
    sqAvailable = false;
    return false;
  }
  try {
    store.setItem(SQ_KEY, JSON.stringify(items));
    sqAvailable = true;
    return true;
  } catch (e) {
    sqAvailable = false;
    return false;
  }
}

// Reads storage and normalises what it finds. Corrupt or wrong-shaped JSON is
// not fatal: it is overwritten with an empty list, so the page starts clean
// instead of failing on every load.
function sqRead() {
  var store = sqStore();
  if (!store) {
    sqAvailable = false;
    return [];
  }
  var raw = null;
  try {
    raw = store.getItem(SQ_KEY);
  } catch (e) {
    sqAvailable = false;
    return [];
  }
  sqAvailable = true;
  if (!raw) return [];
  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    sqWrite([]);
    return [];
  }
  if (!Array.isArray(parsed)) {
    sqWrite([]);
    return [];
  }
  var items = sqNormalise(parsed);
  if (items.length !== parsed.length) sqWrite(items);
  return items;
}

function sqSay(message) {
  if (sqUI && sqUI.elements.status) {
    sqUI.elements.status.textContent = message || '';
  }
}

function sqRender() {
  if (!sqUI || !sqUI.elements.list) return;
  var rows = [];
  for (var i = 0; i < sqItems.length; i++) {
    var item = sqItems[i];
    rows.push(
      '<li class="saved-quotes-item">' +
        '<span class="saved-quotes-text">' + sqEscape(sqExcerpt(item.text, SQ_EXCERPT)) + '</span>' +
        '<span class="saved-quotes-style">' + sqEscape(item.style) + '</span>' +
        '<button type="button" class="saved-quotes-del" data-index="' + i + '">Delete</button>' +
      '</li>'
    );
  }
  sqUI.elements.list.innerHTML = rows.join('');
  if (sqUI.elements.empty) sqUI.elements.empty.hidden = sqItems.length > 0;
}

function sqIndexOf(text) {
  for (var i = 0; i < sqItems.length; i++) {
    if (sqItems[i].text === text) return i;
  }
  return -1;
}

function sqSaveQuote(text, style) {
  var clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    sqSay('Transform some text first');
    return false;
  }
  if (sqIndexOf(clean) >= 0) {
    sqSay('That quote is already saved');
    return false;
  }
  var next = [{ text: clean, style: style || 'Quote', at: Date.now() }].concat(sqItems);
  sqItems = sqNormalise(next);
  var stored = sqWrite(sqItems);
  sqRender();
  sqSay(stored ? 'Quote saved' : SQ_UNAVAILABLE);
  return true;
}

function sqRemove(index) {
  if (typeof index !== 'number' || index < 0 || index >= sqItems.length) return false;
  sqItems.splice(index, 1);
  sqWrite(sqItems);
  sqRender();
  sqSay('Quote deleted');
  return true;
}

// Reading storage back into the list. Exposed because it is the path that has
// to survive a corrupted or over-long entry, and it is also how another tab
// picks up changes made elsewhere.
function sqReload() {
  sqItems = sqRead();
  sqRender();
  if (!sqAvailable) sqSay(SQ_UNAVAILABLE);
  return sqItems.length;
}

function initSavedQuotes() {
  if (sqUI) return sqUI;
  sqItems = sqRead();
  sqUI = {
    elements: { list: null, empty: null, status: null },
    add: sqSaveQuote,
    remove: sqRemove,
    all: function () { return sqItems.slice(); },
    size: function () { return sqItems.length; },
    reload: sqReload,
    render: sqRender,
    message: sqSay,
    available: function () { return sqAvailable; },
  };

  if (typeof document !== 'undefined' && document.getElementById) {
    sqUI.elements.list = document.getElementById('savedQuotesList');
    sqUI.elements.empty = document.getElementById('savedQuotesEmpty');
    sqUI.elements.status = document.getElementById('savedQuotesStatus');
  }

  // One Save button per output on the dashboard, one per page on the style
  // pages; data-save carries the label and data-save-target the element to read,
  // so this file stays identical everywhere.
  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    var buttons = document.querySelectorAll('[data-save]');
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var target = btn.getAttribute('data-save-target') || 'output';
          var label = btn.getAttribute('data-save') || 'Quote';
          var source = document.getElementById(target);
          if (sqSaveQuote(source ? source.textContent : '', label)) {
            btn.innerHTML = '<span>&#10003;</span> Saved';
            btn.classList.add('copied');
            if (typeof setTimeout === 'function') {
              setTimeout(function () {
                btn.innerHTML = '<span>&#128278;</span> Save';
                btn.classList.remove('copied');
              }, 2000);
            }
          }
        });
      })(buttons[i]);
    }
  }

  // The list owns its own Delete buttons, so one delegated listener covers
  // every row, including rows added after this ran.
  var list = sqUI.elements.list;
  if (list && list.addEventListener) {
    list.addEventListener('click', function (e) {
      var node = e && e.target;
      if (!node || !node.getAttribute) return;
      var index = node.getAttribute('data-index');
      if (index === null || index === undefined) return;
      sqRemove(parseInt(index, 10));
    });
  }

  sqRender();
  if (!sqAvailable) sqSay(SQ_UNAVAILABLE);
  return sqUI;
}

// Runs on load in every page; skipped when the file is required under Node,
// where there is no document to wire up.
var savedQuotes = (typeof document !== 'undefined') ? initSavedQuotes() : null;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initSavedQuotes: initSavedQuotes };
}
