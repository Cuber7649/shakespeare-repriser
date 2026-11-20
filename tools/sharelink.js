// Shareable links: encode the current text, style, settings and seed into the
// URL hash. Fragments are never sent to a server, so the privacy story holds.
// This is the ninth shared JS block, pasted into all seven standalone pages.

var SHARE_MAX_TEXT = 1200;
var SHARE_MAX_HASH = 8000;

// A plain, human-readable fragment: share=1&style=shakespeare&i=0&f=15&d=&text=...
// Only the individual values are encoded, so the link reads like a sentence
// instead of a wall of %7B%22 escapes.
function shareEncode(text, style, opts) {
  return [
    'share=1',
    'style=' + encodeURIComponent(style || 'all'),
    'i=' + (opts.intensity === 'light' ? 0 : opts.intensity === 'dramatic' ? 2 : 1),
    'f=' + ((opts.openings ? 1 : 0) | (opts.metaphors ? 2 : 0) |
            (opts.asides ? 4 : 0) | (opts.invert ? 8 : 0)),
    'd=' + ((opts.seed === null || opts.seed === undefined) ? '' : opts.seed),
    'text=' + encodeURIComponent(String(text == null ? '' : text).slice(0, SHARE_MAX_TEXT)),
  ].join('&');
}

function shareDecode(hash) {
  if (!/(?:^#|&)share=1(?:&|$)/.test(hash || '')) return null;
  var q = {};
  var parts = (hash || '').replace(/^#/, '').split('&');
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf('=');
    if (eq > 0) q[parts[i].slice(0, eq)] = parts[i].slice(eq + 1);
  }
  if (q.share !== '1') return null;
  var text, style;
  try {
    text = decodeURIComponent(q.text || '');
    style = q.style ? decodeURIComponent(q.style) : 'all';
  } catch (e) { return null; }
  if (text.length > SHARE_MAX_TEXT) return null;
  var f = q.f === undefined ? 15 : Number(q.f);
  if (!isFinite(f)) return null;
  var seed = (q.d === undefined || q.d === '') ? null : Number(q.d);
  if (seed !== null && (!isFinite(seed) || seed < 0)) seed = null;
  return {
    text: text,
    style: style,
    opts: {
      intensity: q.i === '0' ? 'light' : q.i === '2' ? 'dramatic' : 'balanced',
      openings: !!(f & 1),
      metaphors: !!(f & 2),
      asides: !!(f & 4),
      invert: !!(f & 8),
      seed: seed
    }
  };
}

function shareStyle() {
  if (typeof location === 'undefined') return 'all';
  var name = String(location.pathname || '').split('/').pop().replace(/\.html?$/, '');
  return name === 'index' ? 'all' : (name || 'all');
}

function shareCopyText(text) {
  var status = document.getElementById('copyStatus');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () {
      if (status) status.textContent = 'Share link copied';
    }).catch(function () { shareCopyFallback(text, status); });
  } else {
    shareCopyFallback(text, status);
  }
}

function shareCopyFallback(text, status) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  if (status) status.textContent = 'Share link copied';
}

function shareApply(data) {
  var input = document.getElementById('input');
  if (input) {
    input.value = data.text;
    if (typeof charCountEl !== 'undefined' && charCountEl) {
      charCountEl.textContent = String(data.text.length);
    }
    if (typeof Event !== 'undefined' && input.dispatchEvent) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  if (typeof optApply === 'function') {
    optApply(data.opts);
    optSave(data.opts);
  }
  var primary = document.querySelector('.btn-row .btn-primary');
  if (primary && primary.click) primary.click();
  var status = document.getElementById('copyStatus');
  if (status) status.textContent = 'Shared link restored';
}

function shareLink(btn) {
  var input = document.getElementById('input');
  var text = input ? input.value : '';
  var opts = getTransformOptions();
  var style = (btn && btn.getAttribute && btn.getAttribute('data-share')) || shareStyle();
  var fragment = shareEncode(text, style, opts);
  // Trim the text (never the settings) until the hash fits in a browser URL.
  while (fragment.length > SHARE_MAX_HASH && text.length > 100) {
    text = text.slice(0, Math.floor(text.length * 0.8));
    fragment = shareEncode(text, style, opts);
  }
  // A per-style button on the dashboard links to that style's own page.
  var path = location.pathname;
  if (style !== shareStyle() && /(^|\/)index\.html$/.test(path)) {
    path = path.replace(/index\.html$/, style + '.html');
  }
  var target = path + location.search + '#' + fragment;
  if (path !== location.pathname) {
    // The dashboard's per-style links point at another page. Copy the absolute
    // URL without leaving the dashboard — file:// rejects a cross-file push.
    shareCopyText(new URL(target, location.href).href);
    return fragment;
  }
  try {
    if (typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', target);
    } else {
      location.hash = fragment;
    }
  } catch (e) {
    location.hash = fragment;
  }
  shareCopyText(location.href);
  return fragment;
}

function addShareButton(host, style, id) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-copy';
  btn.id = id;
  btn.setAttribute('data-share', style);
  btn.innerHTML = '<span aria-hidden="true">&#128279;</span> Copy Link';
  btn.addEventListener('click', function () { shareLink(btn); });
  var status = host.querySelector ? host.querySelector('#copyStatus') : null;
  if (status && status.parentNode === host) host.insertBefore(btn, status);
  else host.appendChild(btn);
}

(function () {
  if (typeof document === 'undefined' || !document.getElementById) return;
  if (typeof location === 'undefined' || !location.pathname) return;
  var actions = document.querySelectorAll('.output-actions');
  if (actions.length > 1) {
    // Dashboard: one per style card, reading the style from its Make Card
    // button. Each link opens that style's own page.
    for (var i = 0; i < actions.length; i++) {
      var cardBtn = actions[i].querySelector('[data-card]');
      var style = cardBtn ? cardBtn.getAttribute('data-card') : 'all';
      addShareButton(actions[i], style, 'shareBtn-' + style);
    }
  } else {
    addShareButton(actions[0] || document.querySelector('.btn-row'),
      shareStyle(), 'shareBtn');
  }
  var data = shareDecode(location.hash);
  if (data) shareApply(data);
})();
