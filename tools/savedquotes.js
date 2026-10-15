// Saved quotes: a localStorage-backed list of saved transformations, shared by
// the dashboard and the six style pages.
//
// The pages are standalone -- no shared runtime files -- so this file is pasted
// VERBATIM into all seven of them. tools/test-savedquotes.mjs fails the build if
// any copy drifts: it compares against browserSource() of this file, so the
// CommonJS tail below is the one part that never reaches a page.
//
// Storage is best-effort. file:// browsing and privacy modes can refuse
// localStorage outright, so every access is guarded and, when storage is
// refused, the list lives for the session only and the UI says so.
//
// Schema v2 record: { id, text, original, style, settings, title, at }.
// `text` is the transformed output (kept under its v1 name so existing readers
// and the seed tests keep working); `original` is the input that produced it;
// `settings` is the intensity + toggle snapshot at save time. v1 records
// ({ text, style, at }) are migrated in place by sqNormalise, so an older
// export or an existing localStorage entry loads without loss.

var SQ_KEY = 'repriser.savedQuotes';
var SQ_MAX = 50;
var SQ_EXCERPT = 90;
var SQ_UNAVAILABLE = 'Saving is unavailable in this browser';

// The list itself: [{ id, text, original, style, settings, title, at }],
// newest first. Storage mirrors it and is never the source of truth for an
// in-flight change.
var sqItems = [];
var sqAvailable = true;
var sqUI = null;
var sqQuery = '';
var sqFilter = '';

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

function sqId() {
  return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

// Migrates v1 records, trims, de-duplicates on the output text, resolves id
// collisions and enforces SQ_MAX, in that order. The dedupe key is prefixed so
// a quote that happens to be called "constructor" still dedupes.
function sqNormalise(items) {
  var seen = {};
  var seenIds = {};
  var out = [];
  for (var i = 0; i < items.length && out.length < SQ_MAX; i++) {
    var item = items[i];
    if (!item || typeof item !== 'object') continue;
    var text = typeof item.text === 'string' ? item.text.replace(/\s+/g, ' ').trim() : '';
    if (!text) continue;
    var key = '@' + text;
    if (seen[key]) continue;
    seen[key] = true;
    var id = typeof item.id === 'string' && item.id ? item.id : sqId();
    if (seenIds[id]) id = sqId();
    seenIds[id] = true;
    out.push({
      id: id,
      text: text,
      original: typeof item.original === 'string' ? item.original : '',
      style: typeof item.style === 'string' && item.style ? item.style : 'Quote',
      settings: (item.settings && typeof item.settings === 'object') ? item.settings : null,
      title: typeof item.title === 'string' ? item.title : '',
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

function sqById(id) {
  for (var i = 0; i < sqItems.length; i++) {
    if (sqItems[i].id === id) return sqItems[i];
  }
  return null;
}

function sqMatches(item, query, filter) {
  if (filter && item.style !== filter) return false;
  if (!query) return true;
  var q = query.toLowerCase();
  return (item.text && item.text.toLowerCase().indexOf(q) >= 0)
    || (item.original && item.original.toLowerCase().indexOf(q) >= 0)
    || (item.style && item.style.toLowerCase().indexOf(q) >= 0)
    || (item.title && item.title.toLowerCase().indexOf(q) >= 0);
}

function sqRenderFilter() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  var filterEl = document.getElementById('sqFilter');
  if (!filterEl) return;
  var styles = {};
  for (var i = 0; i < sqItems.length; i++) styles[sqItems[i].style] = true;
  var keys = [];
  for (var k in styles) if (Object.prototype.hasOwnProperty.call(styles, k)) keys.push(k);
  keys.sort();
  var html = '<option value="">All styles</option>';
  for (var j = 0; j < keys.length; j++) {
    html += '<option value="' + sqEscape(keys[j]) + '">' + sqEscape(keys[j]) + '</option>';
  }
  filterEl.innerHTML = html;
  filterEl.value = sqFilter;
  if (filterEl.value !== sqFilter) { sqFilter = ''; filterEl.value = ''; }
}

function sqRender() {
  if (!sqUI || !sqUI.elements.list) return;
  sqRenderFilter();
  var rows = [];
  for (var i = 0; i < sqItems.length; i++) {
    var item = sqItems[i];
    if (!sqMatches(item, sqQuery, sqFilter)) continue;
    rows.push(
      '<li class="saved-quotes-item">' +
        (item.title ? '<span class="saved-quotes-title">' + sqEscape(item.title) + '</span>' : '') +
        '<span class="saved-quotes-text">' + sqEscape(sqExcerpt(item.text, SQ_EXCERPT)) + '</span>' +
        '<span class="saved-quotes-style">' + sqEscape(item.style) + '</span>' +
        '<span class="saved-quotes-row-actions">' +
          '<button type="button" class="saved-quotes-use" data-use="' + sqEscape(item.id) + '">Use</button>' +
          (item.original ? '<button type="button" class="saved-quotes-rerun" data-rerun="' + sqEscape(item.id) + '">Re-run</button>' : '') +
          '<button type="button" class="saved-quotes-del" data-del="' + sqEscape(item.id) + '">Delete</button>' +
        '</span>' +
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

function sqRemoveById(id) {
  for (var i = 0; i < sqItems.length; i++) {
    if (sqItems[i].id === id) {
      sqItems.splice(i, 1);
      sqWrite(sqItems);
      sqRender();
      sqSay('Quote deleted');
      return true;
    }
  }
  return false;
}

function sqRemove(index) {
  if (typeof index !== 'number' || index < 0 || index >= sqItems.length) return false;
  sqItems.splice(index, 1);
  sqWrite(sqItems);
  sqRender();
  sqSay('Quote deleted');
  return true;
}

// Revisit: load the original back into the input and the exact saved output
// into the page's output region (the single #output on a style page, or the
// matching out-<style> card on the dashboard).
function sqUse(id) {
  var item = sqById(id);
  if (!item) return false;
  if (typeof document === 'undefined' || !document.getElementById) return false;
  var input = document.getElementById('input');
  if (input && item.original) input.value = item.original;
  var out = document.getElementById('output');
  if (!out) out = document.getElementById('out-' + item.style.toLowerCase());
  if (out) out.textContent = item.text;
  sqSay('Quote loaded');
  return true;
}

// Regenerate: re-run the transform over the stored original with the stored
// style and settings. Pages can install a window.sqTransformHook(item) for
// precise control (the dashboard re-runs just one style); otherwise this falls
// back to clicking the page's own Transform button, which reads #input and the
// settings controls after they have been restored above.
function sqRerun(id) {
  var item = sqById(id);
  if (!item || !item.original) return false;
  if (typeof document === 'undefined' || !document.getElementById) return false;
  var input = document.getElementById('input');
  if (input) input.value = item.original;
  if (item.settings && typeof optApply === 'function') optApply(item.settings);
  if (typeof window !== 'undefined' && typeof window.sqTransformHook === 'function') {
    window.sqTransformHook(item);
  } else {
    var go = document.getElementById('go');
    if (!go && typeof document.querySelector === 'function') {
      go = document.querySelector('.btn-primary[onclick]');
    }
    if (!go || typeof go.click !== 'function') {
      sqSay('Re-run is not available on this page');
      return false;
    }
    go.click();
  }
  sqSay('Re-transformed with the original style and settings');
  return true;
}

function sqSaveQuote(text, style, original, settings, title) {
  var clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) {
    sqSay('Transform some text first');
    return false;
  }
  if (sqIndexOf(clean) >= 0) {
    sqSay('That quote is already saved');
    return false;
  }
  var next = [{
    id: sqId(),
    text: clean,
    original: typeof original === 'string' ? original : '',
    style: style || 'Quote',
    settings: (settings && typeof settings === 'object') ? settings : null,
    title: typeof title === 'string' ? title : '',
    at: Date.now(),
  }].concat(sqItems);
  sqItems = sqNormalise(next);
  var stored = sqWrite(sqItems);
  sqRender();
  sqSay(stored ? 'Quote saved' : SQ_UNAVAILABLE);
  return true;
}

function sqExportData() {
  return { version: 1, items: sqItems.slice() };
}

function sqExport() {
  var data = sqExportData();
  var json = JSON.stringify(data, null, 2);
  try {
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      sqSay('Export is unavailable in this browser');
      return false;
    }
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'repriser-quotes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (typeof setTimeout === 'function') {
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }
    sqSay('Exported ' + sqItems.length + ' quote(s)');
    return true;
  } catch (e) {
    sqSay('Export failed');
    return false;
  }
}

// Pure, so a test can drive it without a FileReader. Returns { added, skipped }
// on success or { error } on a validation failure; never throws.
function sqImportText(text) {
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { error: 'That file is not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
    return { error: 'That file is not a Repriser export' };
  }
  if (typeof parsed.version === 'number' && parsed.version > 1) {
    return { error: 'That export uses a newer format than this page understands' };
  }
  var incoming = sqNormalise(parsed.items);
  var existingIds = {};
  var seenOut = {};
  var i;
  for (i = 0; i < sqItems.length; i++) {
    existingIds[sqItems[i].id] = true;
    seenOut['@' + sqItems[i].text] = true;
  }
  var added = 0;
  var skipped = 0;
  for (i = 0; i < incoming.length; i++) {
    var item = incoming[i];
    if (seenOut['@' + item.text]) { skipped++; continue; }
    if (existingIds[item.id]) item.id = sqId();
    seenOut['@' + item.text] = true;
    existingIds[item.id] = true;
    sqItems.push(item);
    added++;
  }
  sqItems.sort(function (a, b) { return b.at - a.at; });
  sqItems = sqNormalise(sqItems);
  var stored = sqWrite(sqItems);
  sqRender();
  if (!stored) return { error: SQ_UNAVAILABLE, added: added, skipped: skipped };
  return { added: added, skipped: skipped };
}

var sqClearArmed = false;
var sqClearTimer = null;

function sqClearClick() {
  if (typeof document === 'undefined' || !document.getElementById) return;
  var btn = document.getElementById('sqClear');
  if (!sqClearArmed) {
    sqClearArmed = true;
    if (btn) btn.textContent = 'Confirm clear?';
    sqSay('Click again to clear all saved quotes');
    if (typeof setTimeout === 'function') {
      sqClearTimer = setTimeout(function () {
        sqClearArmed = false;
        if (btn) btn.textContent = 'Clear all';
      }, 4000);
    }
    return;
  }
  sqClearArmed = false;
  if (typeof clearTimeout === 'function' && sqClearTimer) clearTimeout(sqClearTimer);
  if (btn) btn.textContent = 'Clear all';
  sqItems = [];
  sqWrite(sqItems);
  sqRender();
  sqSay('All quotes cleared');
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
    removeById: sqRemoveById,
    byId: sqById,
    use: sqUse,
    rerun: sqRerun,
    exportData: sqExportData,
    importText: sqImportText,
    clearAll: function () { sqItems = []; sqWrite(sqItems); sqRender(); },
    setQuery: function (q) { sqQuery = q || ''; sqRender(); },
    setFilter: function (f) { sqFilter = f || ''; sqRender(); },
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
  // pages; data-save carries the label and data-save-target the element to
  // read, so this file stays identical everywhere. The original input and the
  // current settings are captured alongside the output for revisit and re-run.
  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    var buttons = document.querySelectorAll('[data-save]');
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var target = btn.getAttribute('data-save-target') || 'output';
          var label = btn.getAttribute('data-save') || 'Quote';
          var source = document.getElementById(target);
          var originalEl = document.getElementById('input');
          var titleEl = document.getElementById('sqTitle');
          var settings = (typeof getTransformOptions === 'function') ? getTransformOptions() : null;
          var original = originalEl ? originalEl.value : '';
          var title = titleEl ? titleEl.value : '';
          if (sqSaveQuote(source ? source.textContent : '', label, original, settings, title)) {
            if (titleEl) titleEl.value = '';
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

  // The list owns its own Use / Re-run / Delete buttons, so one delegated
  // listener covers every row, including rows added or filtered after this ran.
  var list = sqUI.elements.list;
  if (list && list.addEventListener) {
    list.addEventListener('click', function (e) {
      var node = e && e.target;
      if (!node || !node.getAttribute) return;
      var del = node.getAttribute('data-del');
      if (del !== null && del !== undefined) { sqRemoveById(del); return; }
      var use = node.getAttribute('data-use');
      if (use !== null && use !== undefined) { sqUse(use); return; }
      var rerun = node.getAttribute('data-rerun');
      if (rerun !== null && rerun !== undefined) { sqRerun(rerun); return; }
    });
  }

  // Toolbar: live search, style filter, export, import, clear-all.
  if (typeof document !== 'undefined' && document.getElementById) {
    var searchEl = document.getElementById('sqSearch');
    if (searchEl && searchEl.addEventListener) {
      searchEl.addEventListener('input', function () {
        sqQuery = searchEl.value || '';
        sqRender();
      });
    }
    var filterEl = document.getElementById('sqFilter');
    if (filterEl && filterEl.addEventListener) {
      filterEl.addEventListener('change', function () {
        sqFilter = filterEl.value || '';
        sqRender();
      });
    }
    var exportBtn = document.getElementById('sqExport');
    if (exportBtn && exportBtn.addEventListener) {
      exportBtn.addEventListener('click', function () { sqExport(); });
    }
    var importBtn = document.getElementById('sqImportBtn');
    var importInput = document.getElementById('sqImport');
    if (importBtn && importBtn.addEventListener && importInput) {
      importBtn.addEventListener('click', function () { importInput.click(); });
    }
    if (importInput && importInput.addEventListener) {
      importInput.addEventListener('change', function () {
        var file = importInput.files && importInput.files[0];
        if (!file) return;
        if (typeof FileReader === 'undefined') {
          sqSay('Import is unavailable in this browser');
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var result = sqImportText(reader.result);
          if (result.error) sqSay(result.error);
          else sqSay('Imported ' + result.added + ' quote(s), skipped ' + result.skipped);
          importInput.value = '';
        };
        reader.onerror = function () {
          sqSay('Could not read that file');
          importInput.value = '';
        };
        reader.readAsText(file);
      });
    }
    var clearBtn = document.getElementById('sqClear');
    if (clearBtn && clearBtn.addEventListener) {
      clearBtn.addEventListener('click', sqClearClick);
    }
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
