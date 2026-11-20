// Offline support: register the service worker only over https. Local file://
// pages and the Node test harness have no service worker scope, so leave them
// alone. Localhost over http is allowed too for local testing (browsers treat
// it as a secure context). Registration is best effort — the pages work online.
if (typeof location !== 'undefined' &&
    (location.protocol === 'https:' ||
     (location.protocol === 'http:' &&
      /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname || ''))) &&
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function () {});
  });
}
