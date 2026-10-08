// Opt-in helper to regenerate Screenshot.png from a real browser render of
// index.html. NOT part of run-all.mjs: the committed image is maintained by hand
// from a real browser, and this would silently overwrite it.
//
// The old screenshot was a hand-taken 1922x1202 crop of the empty shakespeare.html
// page, with the pre-Random eight-entry switcher. It showed one style, nothing
// transformed, and a nav that no longer exists.
//
// This drives headless Edge over the DevTools protocol using only Node built-ins
// (global fetch + WebSocket, no dependencies, matching the project's zero-dep
// rule) so the image can be reproduced on demand rather than by hand.
//
//   node tools/build-screenshot.mjs
//
// Requires Microsoft Edge on Windows. Skips with a clear message if absent.

import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'Screenshot.png');
const PORT = 9333;
const PROFILE = join(ROOT, 'tools', '.edge-screenshot-profile');

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edge = EDGE_CANDIDATES.find((p) => existsSync(p));

if (!edge) {
  console.log('SKIP  Microsoft Edge not found; leaving Screenshot.png unchanged.');
  process.exit(0);
}

// A sentence that exercises the interesting rules in all six styles at once:
// copulas, "very" hedges, verbs of meeting, possessives, "think", will+travel and
// "tomorrow". Chosen so the grid shows six visibly different results rather than
// six variations on the same word.
const DEMO = "I am very happy to see you, my friend, and I think we will travel together tomorrow.";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

// Minimal CDP client over the global WebSocket.
function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let nextId = 1;
    const pending = new Map();

    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
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
      close() { ws.close(); },
    }));
  });
}

const child = spawn(edge, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--remote-allow-origins=*',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--window-size=1920,1200',
  'about:blank',
], { stdio: 'ignore' });

let client;
try {
  if (!await waitForDevtools()) throw new Error('DevTools endpoint never came up');

  // The browser was launched on about:blank so the pinned Math.random could be
  // installed before the real document loads, so any page target will do.
  let target = null;
  for (let i = 0; i < 20 && !target; i++) {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
    if (!target) await sleep(250);
  }
  if (!target) throw new Error('no page target available');

  client = await connect(target.webSocketDebuggerUrl);
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  // Pin Math.random BEFORE any page script runs. The dashboard derives its
  // per-run seed from Math.random, so without this the embellishments (openings,
  // insults, quotes, asides) differ on every build and the committed image is
  // never reproducible -- a permanently dirty diff that hides real changes.
  // mulberry32, matching the shape of the page's own seedRandom.
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(function () {
      var s = 0x5EED1234 >>> 0;
      Math.random = function () {
        s = (s + 0x6D2B79F5) >>> 0;
        var t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();`,
  });

  // Now load the page, so the pinned Math.random is in place first.
  const url = `file:///${join(ROOT, 'index.html').replace(/\\/g, '/')}`;

  // The floating quills are a time-based CSS animation, so their position when
  // the shutter fires differs on every run. The site already honours
  // prefers-reduced-motion (it has an explicit block for it), so ask for that
  // rather than trying to freeze the animation any other way.
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  await client.send('Page.navigate', { url });
  for (let i = 0; i < 80; i++) {
    const r = await client.send('Runtime.evaluate', {
      expression: 'document.readyState', returnByValue: true,
    });
    if (r.result.value === 'complete') break;
    await sleep(125);
  }

  // Webfonts are fetched from Google Fonts over the network, and glyphs render
  // differently depending on whether they have arrived. Block until both families
  // are actually usable, so the capture cannot race the font load.
  await client.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      if (document.fonts && document.fonts.ready) { await document.fonts.ready; }
      for (let i = 0; i < 60; i++) {
        if (document.fonts.check('700 16px Cinzel')
          && document.fonts.check('italic 400 16px "Cormorant Garamond"')) { break; }
        await new Promise(r => setTimeout(r, 250));
      }
      return {
        cinzel: document.fonts.check('700 16px Cinzel'),
        cormorant: document.fonts.check('italic 400 16px "Cormorant Garamond"'),
        status: document.fonts.status,
      };
    })()`,
  }).then((r) => {
    const v = r.result.value;
    console.log(`  fonts: Cinzel=${v.cinzel} Cormorant=${v.cormorant} status=${v.status}`);
  }).catch((e) => console.log(`  fonts: could not confirm (${e.message})`));

  await sleep(400);

  // Wait for the webfonts, then fill the form and run the transform. The textarea
  // needs an input event too, because the char counter listens for it.
  await client.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async () => {
      if (document.fonts && document.fonts.ready) { await document.fonts.ready; }
      const ta = document.getElementById('input');
      ta.value = ${JSON.stringify(DEMO)};
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('go').click();
      await new Promise(r => setTimeout(r, 600));
      return document.querySelectorAll('.out').length + '/' +
        [...document.querySelectorAll('.out')].filter(o => o.textContent.trim()).length;
    })()`,
    returnByValue: true,
  });

  // Log a hash of the rendered text, not just its length, so a run-to-run change
  // in the *content* is distinguishable from harmless rasteriser jitter in the
  // PNG bytes.
  const check = await client.send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('.out')].map(o => o.textContent.trim()).join('|')`,
    returnByValue: true,
  });
  const text = check.result.value || '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  console.log(`  output: ${text.length} chars, fnv1a=${hash.toString(16)}`);

  // Known cosmetic artefact: headless Edge composites a small stray mark into
  // the textarea, sitting inside the text at an offset that moves with the
  // string. It survives caret-color:transparent, cursor:none, and moving the
  // virtual pointer, so it is some compositor overlay rather than a caret or the
  // mouse cursor. It is roughly 6px and shrinks to about 3px at README scale.
  // Left alone deliberately -- suppressing it is not worth more machinery.

  // Full page, not just the viewport, so all six style cards are in frame.
  const metrics = await client.send('Page.getLayoutMetrics');
  const size = metrics.cssContentSize || metrics.contentSize;
  const width = 1920;
  const height = Math.ceil(size.height);

  const shot = await client.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });

  const buf = Buffer.from(shot.data, 'base64');
  writeFileSync(OUT, buf);
  console.log(`  wrote Screenshot.png, ${width}x${height}, ${(buf.length / 1024).toFixed(0)} KB`);
} catch (e) {
  console.log(`FAIL  ${e.message}`);
  process.exitCode = 1;
} finally {
  if (client) client.close();
  child.kill();
  // The throwaway profile is large and is pure build scratch.
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* best effort */ }
}
