// Offline support: register the service worker only over https. Local file://
// pages and the Node test harness have no service worker scope, so leave them
// alone. Registration is best effort — the pages work online without it.
if (typeof location !== 'undefined' && location.protocol === 'https:' &&
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}
