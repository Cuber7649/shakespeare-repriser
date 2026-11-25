// Offline cache for the Text Repriser Collection.
//
// Bump CACHE_VERSION on every deploy that changes a cached file, or returning
// visitors keep the previous version. Old shakespeare-repriser-* caches are
// removed on activate.
const CACHE_VERSION = 'shakespeare-repriser-v18';

const ASSETS = [
  './',
  './index.html',
  './shakespeare.html',
  './pirate.html',
  './victorian.html',
  './chaucer.html',
  './yoda.html',
  './norse.html',
  './manifest.json',
  './llms.txt',
  './fonts/cinzel-latin.woff2',
  './fonts/cormorant-garamond-latin.woff2',
  './fonts/cormorant-garamond-italic-latin.woff2',
  './fonts/unifrakturmaguntia-latin.woff2',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-round-192.png',
  './icon-round-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('shakespeare-repriser-') && key !== CACHE_VERSION)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  // Third-party requests are left alone. The pages make none; fonts, icons and
  // every page are cached locally, so the site works offline.
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        // Keep the worker alive until the write lands; a bare promise can be
        // killed when the worker terminates between the response and the put.
        event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)));
      }
      return response;
    }))
  );
});
