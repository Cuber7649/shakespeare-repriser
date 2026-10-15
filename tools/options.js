// Transformation settings: intensity plus the optional-addition toggles, shared
// by the six style pages and the dashboard.
//
// The pages are standalone -- no shared runtime files -- so this file is pasted
// VERBATIM into all seven of them. tools/test-settings.mjs fails the build if
// any copy drifts: it compares against browserSource() of this file.
//
// getTransformOptions() is called by every page's main function to read the
// current controls. It is self-contained on purpose: it guards against a
// missing document so the generated dashboard can extract it into each style
// module's IIFE and still run headless (tools/verify-dashboard.mjs gives the
// modules no DOM at all). When the controls are absent it returns the defaults,
// and the defaults reproduce the engine's original behaviour exactly -- balanced
// intensity with every optional addition on -- so a page built before this block
// existed transforms identically to one built after.

var OPTS_KEY = 'repriser.settings';

function getTransformOptions() {
  var defs = { intensity: 'balanced', openings: true, metaphors: true, asides: true, invert: true };
  if (typeof document === 'undefined' || !document.getElementById) return defs;
  var intensityEl = document.getElementById('optIntensity');
  var intensity = defs.intensity;
  if (intensityEl) {
    var v = intensityEl.value;
    if (v === 'light' || v === 'dramatic') intensity = v;
  }
  function on(id, def) {
    var el = document.getElementById(id);
    return el ? el.checked !== false : def;
  }
  return {
    intensity: intensity,
    openings: on('optOpenings', defs.openings),
    metaphors: on('optMetaphors', defs.metaphors),
    asides: on('optAsides', defs.asides),
    invert: on('optInvert', defs.invert),
  };
}

// localStorage throws in Safari private mode and some file:// contexts, so the
// whole probe is guarded, mirroring tools/savedquotes.js.
function optStore() {
  try {
    var store = (typeof window !== 'undefined' && window.localStorage) ||
      (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return null;
    var probe = '__repriser_opt_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch (e) {
    return null;
  }
}

function optSave(opts) {
  var store = optStore();
  if (!store) return;
  try { store.setItem(OPTS_KEY, JSON.stringify(opts)); } catch (e) { /* quota or private mode */ }
}

function optLoad() {
  var store = optStore();
  if (!store) return null;
  try {
    var raw = store.getItem(OPTS_KEY);
    if (!raw) return null;
    var o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    return {
      intensity: (o.intensity === 'light' || o.intensity === 'dramatic') ? o.intensity : 'balanced',
      openings: o.openings !== false,
      metaphors: o.metaphors !== false,
      asides: o.asides !== false,
      invert: o.invert !== false,
    };
  } catch (e) {
    return null;
  }
}

function optApply(opts) {
  if (typeof document === 'undefined' || !document.getElementById) return;
  var intensityEl = document.getElementById('optIntensity');
  if (intensityEl) intensityEl.value = opts.intensity;
  function set(id, v) { var el = document.getElementById(id); if (el) el.checked = !!v; }
  set('optOpenings', opts.openings);
  set('optMetaphors', opts.metaphors);
  set('optAsides', opts.asides);
  set('optInvert', opts.invert);
}

function optReset() {
  var defs = { intensity: 'balanced', openings: true, metaphors: true, asides: true, invert: true };
  optApply(defs);
  optSave(defs);
  var status = document.getElementById('optStatus');
  if (status) status.textContent = 'Settings reset to defaults';
}

function initOptions() {
  var saved = optLoad();
  if (saved) optApply(saved);
  if (typeof document === 'undefined' || !document.getElementById) return getTransformOptions();
  var resetBtn = document.getElementById('optResetBtn');
  if (resetBtn && resetBtn.addEventListener) {
    resetBtn.addEventListener('click', function () { optReset(); });
  }
  var ids = ['optIntensity', 'optOpenings', 'optMetaphors', 'optAsides', 'optInvert'];
  for (var i = 0; i < ids.length; i++) {
    (function (id) {
      var el = document.getElementById(id);
      if (el && el.addEventListener) {
        el.addEventListener('change', function () { optSave(getTransformOptions()); });
      }
    })(ids[i]);
  }
  return getTransformOptions();
}

var transformOptions = (typeof document !== 'undefined') ? initOptions() : null;
