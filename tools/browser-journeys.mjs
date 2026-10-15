// Browser-level journeys driven over the DevTools protocol with only Node
// built-ins (global fetch + WebSocket), matching the project's zero-dep rule.
// The same headless-Edge approach as tools/build-screenshot.mjs.
//
// Covers the core user journeys in a real browser (Chromium/Edge; Firefox and
// WebKit are not available on the target machine, so they are not claimed):
//   1. every style page transforms representative text
//   2. the dashboard produces all six outputs
//   3. settings changes are respected by the next transform
//   4. a quote saved on one page is still there on another
//   5. search / filter / delete work on the saved list
//   6. export and import round-trip a backup through the real file input
//   7. a quote card is generated and downloaded as a PNG
//   8. the core UI is operable keyboard-only (Tab, Enter, Escape, focus trap)
//   9. narrow (360px) and wide (1280px) viewports do not overflow sideways
//  10. no JavaScript console errors were raised along the way
//
//   node tools/browser-journeys.mjs
//
// Skips cleanly (exit 0) when Edge is absent, so machines without a browser
// still pass the suite. Firefox/WebKit are not exercised: not installed.

import { spawn } from 'node:child_process';
import { existsSync, rmSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 9334;
const PROFILE = join(ROOT, 'tools', '.edge-journeys-profile');
const DOWNLOADS = join(ROOT, 'tools', '.edge-journeys-downloads');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edge = EDGE_CANDIDATES.find((p) => existsSync(p));

if (!edge) {
  console.log('SKIP  Microsoft Edge not found; browser journeys not run.');
  process.exit(0);
}

const STYLES = [
  ['shakespeare', 'shakespeare.html'],
  ['pirate', 'pirate.html'],
  ['victorian', 'victorian.html'],
  ['chaucer', 'chaucer.html'],
  ['yoda', 'yoda.html'],
  ['norse', 'norse.html'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fileUrl = (f) => 'file:///' + join(ROOT, f).replace(/\\/g, '/');

let failures = 0;
const fail = (m) => { console.log(`FAIL  ${m}`); failures++; };
const pass = (m) => console.log(`ok    ${m}`);

async function waitForDevtools() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

// Minimal CDP client over the global WebSocket. `on(fn)` receives unsolicited
// events (console, exceptions, logs) alongside request/response pairing.
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let nextId = 1;
    const pending = new Map();
    const handlers = [];

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) {
        for (const h of handlers) h(msg);
      }
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const id = nextId++;
        return new Promise((res, rej) => {
          pending.set(id, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      on(fn) { handlers.push(fn); },
      close() { ws.close(); },
    }));
  });
}

function listedDownloads() {
  if (!existsSync(DOWNLOADS)) return [];
  return readdirSync(DOWNLOADS).map((f) => join(DOWNLOADS, f));
}

async function waitForFile(pred, ms) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const hit = listedDownloads().find(pred);
    if (hit) return hit;
    await sleep(200);
  }
  return null;
}

const child = spawn(edge, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--remote-allow-origins=*',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--window-size=1280,900',
  'about:blank',
], { stdio: 'ignore' });

let browser;   // browser-level session (downloads)
let page;      // page session (everything else)

// Console noise policy: uncaught exceptions and console.error are failures.
// Network resource errors (the Google Fonts stylesheet when offline) are
// counted and reported but do not fail the run — they are environment, not app.
const consoleErrors = [];
let networkErrors = 0;
let manifestNoise = 0;

async function goto(file) {
  await page.send('Page.navigate', { url: fileUrl(file) });
  for (let i = 0; i < 80; i++) {
    const r = await page.send('Runtime.evaluate', {
      expression: 'document.readyState', returnByValue: true,
    });
    if (r.result.value === 'complete') return;
    await sleep(125);
  }
  throw new Error(`navigation to ${file} never reached readyState complete`);
}

async function evalJs(expression) {
  const r = await page.send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (r.exceptionDetails) {
    throw new Error('page evaluate failed: ' +
      ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) ||
        r.exceptionDetails.text));
  }
  return r.result.value;
}

// Trusted key press through the input domain (a real Tab/Enter/Escape).
// `keyDown` (not `rawKeyDown`) so the browser performs its default action:
// Enter activates the focused button, Tab moves focus. Enter also needs the
// `text` field set or Chromium skips the click default-action entirely.
async function pressKey(key, code, vk) {
  const text = key === 'Enter' ? '\r' : '';
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown', key, code, text,
    windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key, code,
    windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
  });
}

try {
  if (!await waitForDevtools()) throw new Error('DevTools endpoint never came up');

  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!target) throw new Error('no page target available');

  // Browser-level session for download behaviour (Browser.* needs it).
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  browser = await connect(ver.webSocketDebuggerUrl);
  mkdirSync(DOWNLOADS, { recursive: true });
  await browser.send('Browser.setDownloadBehavior', {
    behavior: 'allow', downloadPath: DOWNLOADS, eventsEnabled: true,
  });

  page = await connect(target.webSocketDebuggerUrl);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Log.enable');
  page.on((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleErrors.push((d.exception && d.exception.description) || d.text);
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      if (msg.params.entry.source === 'network') networkErrors++;
      // file:// pages cannot fetch their PWA manifest (CORS: origin "null").
      // Environment limitation of local-file loading, not an app error.
      else if (/manifest\.json/.test(msg.params.entry.text) &&
               /CORS policy/i.test(msg.params.entry.text)) manifestNoise++;
      else consoleErrors.push(msg.params.entry.text);
    }
  });

  // Quills are time-based CSS animation; freeze them the way the site already
  // supports, so geometry checks (responsive overflow) are deterministic.
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  // --- 1. every style page transforms representative text ------------------
  const SAMPLE = 'you are my friend and it is very good';
  for (const [id, file] of STYLES) {
    await goto(file);
    const out = await evalJs(`(() => {
      const ta = document.getElementById('input');
      ta.value = ${JSON.stringify(SAMPLE)};
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.btn-row .btn-primary').click();
      return document.getElementById('output').textContent;
    })()`);
    if (!out || !out.trim()) fail(`${file}: transform produced no output`);
    else if (out.trim() === SAMPLE) fail(`${file}: output is unchanged from the input`);
    else pass(`${file}: transformed to ${out.trim().length} chars`);
  }

  // --- 2. the dashboard produces all six outputs ---------------------------
  await goto('index.html');
  const dash = await evalJs(`(() => {
    const ta = document.getElementById('input');
    ta.value = ${JSON.stringify(SAMPLE)};
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('go').click();
    const outs = [...document.querySelectorAll('.out')];
    return { total: outs.length, filled: outs.filter((o) => o.textContent.trim()).length };
  })()`);
  if (dash.total !== 6) fail(`dashboard has ${dash.total} output cards, expected 6`);
  else if (dash.filled !== 6) fail(`dashboard filled ${dash.filled} of 6 outputs`);
  else pass('dashboard filled all six style outputs');

  // --- 3. settings changes are respected -----------------------------------
  // Seeded so the comparison isolates the settings, not the RNG.
  await goto('shakespeare.html');
  const settings = await evalJs(`(() => {
    seedRandom(42);
    document.getElementById('input').value = ${JSON.stringify(SAMPLE)};
    document.querySelector('.btn-row .btn-primary').click();
    const before = document.getElementById('output').textContent;
    const openings = document.getElementById('optOpenings');
    openings.click();                       // toggles + fires change
    const saved = JSON.parse(localStorage.getItem('repriser.settings') || '{}');
    seedRandom(42);
    document.querySelector('.btn-row .btn-primary').click();
    const after = document.getElementById('output').textContent;
    openings.click();                       // restore for later journeys
    return { before, after, savedOpenings: saved.openings };
  })()`);
  if (settings.savedOpenings !== false) {
    fail(`unchecking openings did not persist (got ${JSON.stringify(settings.savedOpenings)})`);
  } else if (settings.before === settings.after) {
    fail('output did not change when openings were disabled at the same seed');
  } else pass('settings persist and the next transform respects them');

  // --- 4. a quote saved on one page is still there on another --------------
  // Chromium shares localStorage across file:// pages in one profile, which is
  // exactly the cross-page behaviour the app documents.
  const savedText = await evalJs(`(() => {
    document.querySelector('[data-save]').click();
    return document.getElementById('output').textContent;
  })()`);
  await goto('yoda.html');
  const crossPage = await evalJs(`(() => ({
    rows: document.querySelectorAll('#savedQuotesList .saved-quotes-item').length,
    hasText: document.getElementById('savedQuotesList').textContent.includes(
      ${JSON.stringify((savedText || '').trim().slice(0, 24))}),
  }))()`);
  if (!crossPage.rows) fail('a quote saved on shakespeare.html is missing on yoda.html');
  else if (savedText && !crossPage.hasText) {
    fail('the saved quote text is not shown in the list on yoda.html');
  } else pass(`saved quote carried across pages (${crossPage.rows} row(s) on yoda.html)`);

  // --- 5. search / filter / delete -----------------------------------------
  // Save a second, distinct quote on yoda so search and filter have two rows.
  await evalJs(`(() => {
    const ta = document.getElementById('input');
    ta.value = 'the war will end in victory';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.btn-row .btn-primary').click();
    document.querySelector('[data-save]').click();
  })()`);
  const listOps = await evalJs(`(() => {
    const rows = () => document.querySelectorAll('#savedQuotesList .saved-quotes-item').length;
    const all = rows();
    const search = document.getElementById('sqSearch');
    search.value = 'victory';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const searched = rows();
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const filter = document.getElementById('sqFilter');
    const other = [...filter.options].map((o) => o.value).find((v) => v && v !== 'Yoda');
    filter.value = other || 'Shakespeare';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    const filtered = rows();
    filter.value = '';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    const beforeDel = rows();
    document.querySelector('#savedQuotesList [data-del]').click();
    return { all, searched, filtered, beforeDel, afterDel: rows() };
  })()`);
  if (listOps.all < 2) fail(`expected at least 2 saved rows, got ${listOps.all}`);
  else if (listOps.searched !== 1) fail(`search "victory" left ${listOps.searched} row(s), expected 1`);
  else if (listOps.filtered < 1) fail('style filter left no rows');
  else if (listOps.afterDel !== listOps.beforeDel - 1) {
    fail(`delete did not remove a row (${listOps.beforeDel} -> ${listOps.afterDel})`);
  } else pass(`search (${listOps.searched}), filter (${listOps.filtered}) and delete (${listOps.beforeDel}->${listOps.afterDel}) work`);

  // --- 6. export and import round-trip through the real file input ---------
  const roundTrip = await evalJs(`(() => {
    document.getElementById('sqExport').click();
    return document.querySelectorAll('#savedQuotesList .saved-quotes-item').length;
  })()`);
  const exportFile = await waitForFile((f) => f.endsWith('repriser-quotes.json'), 8000);
  if (!exportFile) fail('export did not produce repriser-quotes.json');
  else {
    // Two-step clear: first click arms, second confirms.
    await evalJs(`(() => {
      document.getElementById('sqClear').click();
      document.getElementById('sqClear').click();
    })()`);
    const cleared = await evalJs(
      'document.querySelectorAll("#savedQuotesList .saved-quotes-item").length');
    if (cleared !== 0) fail(`clear-all left ${cleared} row(s)`);

    // Drive the real <input type="file"> with the exported file.
    await page.send('DOM.enable');
    const doc = await page.send('DOM.getDocument', { depth: 0 });
    const node = await page.send('DOM.querySelector', {
      nodeId: doc.root.nodeId, selector: '#sqImport',
    });
    if (!node.nodeId) fail('no #sqImport file input found');
    else {
      await page.send('DOM.setFileInputFiles', {
        files: [exportFile], nodeId: node.nodeId,
      });
      await evalJs(`(() => {
        document.getElementById('sqImport').dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await sleep(400);   // FileReader is async
      const restored = await evalJs(
        'document.querySelectorAll("#savedQuotesList .saved-quotes-item").length');
      if (restored !== roundTrip) {
        fail(`import restored ${restored} row(s), export had ${roundTrip}`);
      } else pass(`export (${roundTrip} quotes) and import round-tripped through the file input`);
    }
  }

  // --- 7. generate and download a quote card -------------------------------
  await goto('shakespeare.html');
  const card = await evalJs(`(() => {
    const ta = document.getElementById('input');
    ta.value = ${JSON.stringify(SAMPLE)};
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.btn-row .btn-primary').click();
    document.getElementById('makeCardBtn').click();
    return { opened: !document.getElementById('cardModal').hidden };
  })()`);
  if (!card.opened) fail('Make Card did not open the modal');
  else {
    // The canvas paints asynchronously (fonts + promise chain); wait for the
    // status region to report readiness rather than a fixed sleep.
    let ready = false;
    for (let i = 0; i < 40; i++) {
      const status = await evalJs('document.getElementById("cardStatus").textContent');
      if (/card ready/i.test(status)) { ready = true; break; }
      await sleep(150);
    }
    if (!ready) fail('card modal never reported readiness');
    else {
      await evalJs('document.getElementById("cardDownload").click()');
      const png = await waitForFile((f) => f.endsWith('repriser-shakespeare-card.png'), 8000);
      if (!png) fail('card download did not produce repriser-shakespeare-card.png');
      else if (statSync(png).size < 1000) fail(`downloaded card is only ${statSync(png).size} bytes`);
      else pass(`quote card downloaded (${(statSync(png).size / 1024).toFixed(0)} KB PNG)`);
      await evalJs('document.getElementById("cardClose").click()');
    }
  }

  // --- 8. keyboard-only operation ------------------------------------------
  await goto('shakespeare.html');
  const kb = await evalJs(`(() => {
    const ta = document.getElementById('input');
    ta.value = 'a keyboard journey for thee';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
    return document.activeElement === ta;
  })()`);
  if (!kb) fail('could not focus the input for the keyboard journey');
  else {
    await pressKey('Tab', 'Tab', 9);
    const onButton = await evalJs(
      `document.activeElement.classList.contains('btn-primary')`);
    if (!onButton) fail('Tab from the input did not reach the Transform button');
    else {
      await pressKey('Enter', 'Enter', 13);
      const out = await evalJs('document.getElementById("output").textContent');
      if (!out.trim()) fail('Enter on the Transform button produced no output');
      else pass('Tab + Enter transformed text without a mouse');
    }
    // Tab along to Make Card (Clear is next, then Make Card).
    await pressKey('Tab', 'Tab', 9);
    await pressKey('Tab', 'Tab', 9);
    const onCard = await evalJs(
      `document.activeElement.id === 'makeCardBtn'`);
    if (!onCard) fail('Tab did not reach the Make Card button');
    else {
      await pressKey('Enter', 'Enter', 13);
      const opened = await evalJs('!document.getElementById("cardModal").hidden');
      if (!opened) fail('Enter on Make Card did not open the modal');
      else {
        // Focus trap: many Tabs must stay inside the dialog.
        let trapped = true;
        for (let i = 0; i < 15; i++) {
          await pressKey('Tab', 'Tab', 9);
          const inside = await evalJs(
            `document.getElementById('cardModal').contains(document.activeElement)`);
          if (!inside) { trapped = false; break; }
        }
        if (!trapped) fail('Tab escaped the card modal (focus trap broken)');
        else pass('modal opens by keyboard and traps Tab focus');
        await pressKey('Escape', 'Escape', 27);
        const closed = await evalJs('document.getElementById("cardModal").hidden');
        if (!closed) fail('Escape did not close the card modal');
        else pass('Escape closes the card modal');
      }
    }
  }

  // --- 9. responsive: no sideways overflow at 360px or 1280px --------------
  for (const [w, h, label] of [[360, 740, 'narrow'], [1280, 900, 'wide']]) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile: w < 500,
    });
    for (const file of ['shakespeare.html', 'index.html']) {
      await goto(file);
      const sw = await evalJs('document.scrollingElement.scrollWidth');
      if (sw > w + 1) fail(`${label} ${file}: horizontal overflow (scrollWidth ${sw} > ${w})`);
      else pass(`${label} ${file}: no horizontal overflow at ${w}px`);
    }
  }
  await page.send('Emulation.clearDeviceMetricsOverride');

  // --- 10. console errors ---------------------------------------------------
  if (consoleErrors.length) {
    fail(`${consoleErrors.length} console error(s): ${consoleErrors.slice(0, 3).join(' | ')}`);
  } else pass('no JavaScript console errors');
  if (networkErrors) {
    console.log(`      (${networkErrors} network resource error(s) ignored — offline font CDN?)`);
  }
  if (manifestNoise) {
    console.log(`      (${manifestNoise} file:// manifest CORS error(s) ignored — PWA manifest needs http(s))`);
  }

  console.log(failures ? `\n${failures} journey check(s) FAILED` : '\nall browser journeys passed');
  process.exitCode = failures ? 1 : 0;
} catch (e) {
  console.log(`FAIL  ${e.message}`);
  process.exitCode = 1;
} finally {
  if (page) page.close();
  if (browser) browser.close();
  child.kill();
  for (const dir of [PROFILE, DOWNLOADS]) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
