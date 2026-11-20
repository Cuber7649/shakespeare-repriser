// Static gate for the offline service worker and its registration snippet.
// The journeys run from file:// where a service worker cannot register, so the
// https-only wiring and the cache manifest are checked here instead.
//   node tools/test-serviceworker.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { browserSource } from './page-source.mjs';
import { ALL_PAGES } from './styles.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const norm = (s) => s.replace(/\r\n/g, '\n');

let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };

// --- 1. the cache script ------------------------------------------------------
console.log('\nsw.js');

let sw;
try { sw = norm(read('sw.js')); }
catch { no('sw.js is missing'); sw = ''; }

if (sw) {
  if (/const CACHE_VERSION = 'shakespeare-repriser-v\d+';/.test(sw)) {
    ok('versioned cache name (bump on deploy)');
  } else no('no versioned CACHE_VERSION constant');

  for (const event of ['install', 'activate', 'fetch']) {
    sw.includes(`self.addEventListener('${event}'`)
      ? ok(`${event} handler present`)
      : no(`missing ${event} handler`);
  }

  sw.includes('caches.delete(key)') && sw.includes("key.startsWith('shakespeare-repriser-')")
    ? ok('old cache versions are purged on activate')
    : no('old cache versions are not purged');

  sw.includes("request.url).origin !== self.location.origin")
    ? ok('cross-origin requests (Google Fonts) are left alone')
    : no('cross-origin requests are not excluded');

  const ASSETS = [
    ...ALL_PAGES, 'manifest.json',
    'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  ];
  const missing = ASSETS.filter((a) => !sw.includes(`'./${a}'`));
  missing.length
    ? no(`cache manifest missing: ${missing.join(', ')}`)
    : ok(`cache manifest covers all ${ASSETS.length} pages and assets`);
}

// --- 2. the registration snippet, pasted into all seven pages -----------------
console.log('\nregistration');

let snippet;
try { snippet = norm(browserSource(read('tools/sw-register.js'))).trimEnd(); }
catch { no('tools/sw-register.js is missing'); snippet = ''; }

if (snippet) {
  snippet.includes("location.protocol === 'https:'")
    && snippet.includes('localhost')
    && snippet.includes("typeof location !== 'undefined'")
    ? ok('registers only in secure contexts, harness-safe')
    : no('registration is not restricted to secure contexts');
  snippet.includes("register('./sw.js')")
    ? ok('registers ./sw.js at the page scope')
    : no('registration does not point at ./sw.js');

  for (const page of ALL_PAGES) {
    norm(read(page)).includes(snippet)
      ? ok(`${page}: registration block in sync`)
      : no(`${page}: registration block missing or drifted`);
  }
}

console.log(failures ? `\n${failures} service-worker check(s) failed`
  : '\nservice worker is wired into all seven pages');
process.exit(failures ? 1 : 0);
