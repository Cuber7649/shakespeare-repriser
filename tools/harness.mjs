// Loads a repriser page's inline <script> into a sandbox with stubbed DOM
// so the transform engine can be exercised from Node with a fixed seed.
// Zero dependencies.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Attributes come from the page's own markup and `hidden` is seeded from it:
// cardui.js branches on hidden, and a stub that starts open would make "the
// modal did not open" untestable. Listeners are captured so a test can drive
// the page through the same handler a real click would run.
function makeEl(opts) {
  const o = opts || {};
  const attrs = Object.assign({}, o.attrs);
  const handlers = {};
  const el = {
    id: o.id || '',
    hidden: !!o.hidden,
    value: '',
    textContent: '',
    innerHTML: '',
    offsetWidth: 0,
    style: {},
    dataset: {},
    files: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute(name, value) { attrs[name] = String(value); },
    addEventListener(type, fn) {
      if (!handlers[type]) handlers[type] = [];
      handlers[type].push(fn);
    },
    removeEventListener(type, fn) {
      const list = handlers[type] || [];
      const at = list.indexOf(fn);
      if (at >= 0) list.splice(at, 1);
    },
    appendChild() {},
    removeChild() {},
    select() {},
    focus() {},
    click() { el._fire('click'); },
    _fire(type, event) {
      const list = (handlers[type] || []).slice();
      const evt = event || { type, target: el, preventDefault() {} };
      for (const fn of list) fn.call(el, evt);
      return list.length;
    },
  };
  return el;
}

// id -> attributes, taken from the markup only (script and style bodies are
// dropped first so a stray `<` in the code cannot look like a tag).
function markupInfo(html) {
  const markup = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  const attrsById = new Map();
  const hiddenIds = new Set();
  for (const m of markup.matchAll(/<[a-z][a-z0-9]*\b[^>]*>/gi)) {
    const id = m[0].match(/\bid="([^"]+)"/);
    if (!id) continue;
    const attrs = {};
    for (const a of m[0].matchAll(/\s([a-z-]+)(?:="([^"]*)")?/gi)) {
      if (a[1] === 'id') continue;
      attrs[a[1]] = a[2] === undefined ? '' : a[2];
    }
    attrsById.set(id[1], attrs);
    if (Object.prototype.hasOwnProperty.call(attrs, 'hidden')) hiddenIds.add(id[1]);
  }
  return { attrsById, hiddenIds };
}

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

function extractScript(html) {
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1])
    .filter((s) => s.trim().length > 0);
  if (!blocks.length) throw new Error('no inline <script> found');
  return blocks[blocks.length - 1];
}

// Top-level declarations only (column 0), so nested bodies never match.
function topLevelNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) names.add(m[1]);
  names.delete('Math');
  return [...names];
}

/**
 * @param {string} file  path to a .html page
 * @param {string} entry name of the main transform function
 */
export function loadPage(file, entry) {
  const html = readFileSync(file, 'utf8');
  const src = extractScript(html);
  const info = markupInfo(html);
  const names = topLevelNames(src);

  if (!names.includes(entry)) {
    throw new Error(`entry "${entry}" not found in ${file}`);
  }

  // const/let are lexically scoped and invisible from outside the script, so
  // hand them out through an explicit object.
  const shim = `${src}\n;globalThis.__api = { ${names.join(', ')} };`;

  const els = new Map();
  const elementFor = (id) => {
    if (!els.has(id)) {
      els.set(id, makeEl({
        id,
        hidden: info.hiddenIds.has(id),
        attrs: info.attrsById.get(id) || {},
      }));
    }
    return els.get(id);
  };
  const sandbox = {
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    Math,
    JSON,
    Date,
    document: {
      getElementById(id) {
        return elementFor(id);
      },
      createElement: () => makeEl(),
      body: { appendChild() {}, removeChild() {} },
      execCommand: () => true,
      addEventListener() {},
    },
    navigator: { clipboard: null, userAgent: 'node' },
    localStorage: makeStorage(),
    alert() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(shim, sandbox, { filename: file });

  const api = sandbox.__api;
  const inputEl = sandbox.document.getElementById('input');
  const outputEl = sandbox.document.getElementById('output');

  return {
    file,
    api,
    names,
    has: (n) => names.includes(n),

    // Exposed so tests can seed or break storage and read back the elements a
    // page's own UI code wrote (saved quotes uses both).
    storage: sandbox.localStorage,
    document: sandbox.document,

    /** Run a listener the page itself registered: fire(btn, 'click'). */
    fire(el, type, event) {
      if (!el || typeof el._fire !== 'function') return 0;
      return el._fire(type, event);
    },

    /** Run the page's main transform on `text` with a deterministic seed. */
    transform(text, seed = 1) {
      inputEl.value = text;
      outputEl.textContent = '';
      if (api.seedRandom) api.seedRandom(seed);
      api[entry]();
      return outputEl.textContent;
    },
  };
}
