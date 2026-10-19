// Generates a self-contained index.html that shows every style side by side.
//
// Why generate instead of hand-writing index.html: the dashboard needs all six
// dictionaries in one file, which would mean ~230KB of hand-copied data that
// silently rots whenever a style page changes. The generator rebuilds it from
// the style pages, and the OUTPUT is still one self-contained file with no
// shared runtime files, so the project's rules hold for what ships.
//
// Each style's IIFE contains that page's dictionaries, engine, helpers and main
// function copied VERBATIM, so the dashboard cannot drift from the pages.
// tools/verify-dashboard.mjs asserts behavioural equality.
//
// The "Make Card" modal is shared with random.html: its wiring lives in
// tools/cardui.js and its markup and styles in tools/card-modal.{html,css}, all
// inlined below, so the two flows cannot drift apart.
//
//   node tools/build-dashboard.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { html, scriptOf, extractDecl, extractFunction, between, browserSource, stripMediaQuery } from './page-source.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Every style's main function calls these; they are extracted verbatim from
// each page. Yoda's yodaify additionally calls frontObject (below).
const HELPERS = [
  'maybeAddAlliteration', 'maybeAddMetaphor', 'maybeInsertQuote', 'maybeInsertInsult',
  'maybeAddAside', 'maybeAddStageDirection', 'maybeInvert', 'maybeAddFiller',
  'maybeAddParenthetical', 'transformParagraph', 'getTransformOptions',
];

const STYLES = [
  { id: 'shakespeare', label: 'Shakespeare', href: 'shakespeare.html', entry: 'shakespearify', icon: '&#128220;' },
  { id: 'pirate', label: 'Pirate', href: 'pirate.html', entry: 'pirateify', icon: '&#9875;' },
  { id: 'victorian', label: 'Victorian', href: 'victorian.html', entry: 'victorianify', icon: '&#128187;' },
  { id: 'chaucer', label: 'Chaucer', href: 'chaucer.html', entry: 'chaucerify', icon: '&#128220;' },
  { id: 'yoda', label: 'Yoda', href: 'yoda.html', entry: 'yodaify', icon: '&#128161;', helpers: [...HELPERS, 'frontObject', 'frontInfinitive'] },
  { id: 'norse', label: 'Norse', href: 'norse.html', entry: 'norseify', icon: '&#9876;' },
];

const DICTS = [
  'openings', 'midInsertions', 'quotes', 'metaphors', 'insults', 'asides',
  'stageDirections', 'inversions', 'alliterations', 'negatives', 'pronouns',
  'verbForms', 'commonWords', 'verbs', 'adjectives', 'nouns', 'contractions',
  'sentenceTransforms',
];

// html(), scriptOf(), extractDecl(), extractFunction(), between(), browserSource()
// and stripMediaQuery() now live in tools/page-source.mjs, shared with
// tools/build-random.mjs.

function styleModule(style) {
  const src = scriptOf(html(ROOT, style.href));

  const dicts = DICTS.map((n) => extractDecl(src, n));

  // The RNG pieces, pulled out individually: they sit before the decorative
  // arrays, so a single range would swallow those and collide with `dicts`.
  const rng = [
    extractDecl(src, '_randomSeed'),
    extractDecl(src, '_rngState'),
    extractFunction(src, 'seedRandom'),
    extractFunction(src, 'rand'),
    extractDecl(src, 'pick'),
    extractDecl(src, 'chance'),
  ];

  // Replacement engine, verbatim, delimited by the banner comment we added.
  const engine = between(
    src,
    /^\/\/ =+\r?\n\/\/ REPLACEMENT ENGINE\r?\n/m,
    /^\/\/ =+\r?\n\/\/ HELPER:/m,
    `${style.id} engine`
  );

  const helpers = (style.helpers || HELPERS).map((n) => extractFunction(src, n));
  const main = extractFunction(src, style.entry);

  return `STYLES[${JSON.stringify(style.id)}] = (function () {
${dicts.join('\n')}

${rng.join('\n\n')}

${engine}
${helpers.join('\n\n')}

  const inputEl = { value: '' };
  const outputEl = {
    textContent: '', offsetWidth: 0,
    classList: { remove() {}, add() {} },
  };

${main}

  return {
    label: ${JSON.stringify(style.label)},
    href: ${JSON.stringify(style.href)},
    icon: ${JSON.stringify(style.icon)},
    seed: seedRandom,
    transform: function (text, seed) {
      if (seed !== undefined) seedRandom(seed);
      inputEl.value = text;
      outputEl.textContent = '';
      outputEl.classList.remove('active');
      ${style.entry}();
      return outputEl.textContent;
    },
  };
})();`;
}

const modules = STYLES.map(styleModule).join('\n\n');
writeFileSync(join(ROOT, 'tools', '.dashboard-modules.js'), modules);
console.log(`built ${STYLES.length} style modules, ${(modules.length / 1024).toFixed(0)} KB`);

// Quote card logic is inlined verbatim from tools/quotecard.js, so the browser
// and tools/test-quotecard.mjs run the exact same source.
const quotecard = browserSource(
  readFileSync(join(ROOT, 'tools', 'quotecard.js'), 'utf8'));

// The preview modal lives in tools/cardui.js + the two card-modal.* fragments
// and is shared with tools/build-random.mjs, so the two "Make Card" flows cannot
// drift apart.
const cardui = browserSource(
  readFileSync(join(ROOT, 'tools', 'cardui.js'), 'utf8'));
const cardModalHtml = readFileSync(join(ROOT, 'tools', 'card-modal.html'), 'utf8').trimEnd();
const cardModalCss = readFileSync(join(ROOT, 'tools', 'card-modal.css'), 'utf8').trimEnd();

// Saved quotes are pasted into every page from tools/savedquotes.js, so the
// dashboard takes the same block. Its stylesheet needs no special handling:
// savedquotes.css is pasted into the style pages, and baseCss below is built
// from shakespeare.html, so the rules arrive with it.
const savedQuotesJs = browserSource(
  readFileSync(join(ROOT, 'tools', 'savedquotes.js'), 'utf8'));
const savedQuotesHtml = readFileSync(join(ROOT, 'tools', 'savedquotes.html'), 'utf8').trimEnd();
const compareJs = browserSource(
  readFileSync(join(ROOT, 'tools', 'compare.js'), 'utf8'));

// Transformation settings, pasted into every page from tools/options.js. Its
// stylesheet rides along via baseCss (built from shakespeare.html). The JS is
// inlined once at the top level for the reset/persistence wiring; each style
// module also carries its own getTransformOptions (via HELPERS) so the modules
// stay self-contained for tools/verify-dashboard.mjs.
const optionsJs = browserSource(
  readFileSync(join(ROOT, 'tools', 'options.js'), 'utf8'));
const optionsHtml = readFileSync(join(ROOT, 'tools', 'options.html'), 'utf8').trimEnd();

// ---------------------------------------------------------------------------
// Compose index.html
// ---------------------------------------------------------------------------

// The style pages already carry a prefers-reduced-motion block; drop it so the
// dashboard ships exactly one, merged below to also cover the new .mini cards.
const baseCss = stripMediaQuery(
  html(ROOT, 'shakespeare.html').match(/<style>([\s\S]*?)<\/style>/)[1],
  '(prefers-reduced-motion: reduce)');

const DASH_CSS = `
  /* ====== DASHBOARD ====== */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 18px;
    margin-top: 20px;
  }
  .mini {
    background: linear-gradient(180deg, #fdf6e3 0%, #f4e8cd 100%);
    border: 1px solid rgba(196,162,101,0.55);
    border-radius: 10px;
    padding: 16px 18px 14px;
    box-shadow: 0 2px 10px rgba(61,43,31,0.12);
  }
  .mini-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    border-bottom: 1px solid rgba(196,162,101,0.35);
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  .mini .output-actions .btn-copy {
    flex: 1 1 calc(50% - 4px);
    justify-content: center;
  }
  .mini-name {
    font-family: 'Cinzel', serif;
    font-weight: 700;
    font-size: 1.05rem;
    color: #3d2b1f;
  }
  .mini-link {
    font-family: 'Cormorant Garamond', serif;
    font-size: 0.85rem;
    color: #8a6a3a;
    text-decoration: underline;
  }
  .out {
    min-height: 90px;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    font-style: italic;
    line-height: 1.7;
    font-size: 1.05rem;
    color: #3d2b1f;
  }
  .out:empty::before {
    content: 'Awaiting transformation...';
    color: #b8956a;
    font-style: italic;
  }
  .visually-hidden {
    position: absolute;
    width: 1px; height: 1px;
    padding: 0; margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .quill, .float-quill, .card, .output-card, .mini,
    .btn-primary::after, #output.active, #cardModal .modal-box {
      animation: none !important;
    }
  }

${cardModalCss}
`;

const cards = STYLES.map((s) => `      <section class="mini">
        <div class="mini-head">
          <span class="mini-name"><span class="mini-icon">${s.icon}</span> ${s.label}</span>
          <a class="mini-link" href="./${s.href}">Open page</a>
        </div>
        <div class="out" id="out-${s.id}"></div>
        <div class="output-actions">
          <button class="btn-copy" data-card="${s.id}">
            <span>&#9786;</span> Make Card
          </button>
          <button class="btn-copy" data-copy="${s.id}">
            <span>&#128203;</span> Copy
          </button>
          <button class="btn-copy" data-save="${s.label}" data-save-target="out-${s.id}">
            <span>&#128222;</span> Save
          </button>
          <button class="btn-copy" data-compare="out-${s.id}">
            <span>&#8644;</span> Compare
          </button>
        </div>
      </section>`).join('\n');

const navLinks = [
  ...STYLES.map((s) => `<a href="./${s.href}">${s.label}</a>`),
].join('\n');

const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Text Repriser Collection</title>
<meta name="description" content="Rewrite modern English into six historical and literary styles, side by side.">
<link rel="manifest" href="./manifest.json">
<meta name="theme-color" content="#2b2d42">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Repriser">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="apple-touch-icon" href="./icon-180.png">
<link rel="icon" href="./icon.svg" type="image/svg+xml">
<link rel="icon" href="./icon-192.png" sizes="192x192" type="image/png">
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=UnifrakturMaguntia&display=swap" rel="stylesheet">
<style>${baseCss}${DASH_CSS}</style>
</head>
<body>

<div class="float-quill">&#128396;</div>
<div class="float-quill">&#128396;</div>
<div class="float-quill">&#128396;</div>
<div class="float-quill">&#128396;</div>

  <div class="style-switcher">
    <a href="./index.html" class="active">All Styles</a>
${navLinks}
  </div>

<div class="container">
  <header class="header">
    <span class="quill">&#128396;</span>
    <h1>Text Repriser Collection</h1>
    <p class="subtitle">Six styles, side by side</p>
  </header>

  <div class="divider">&#10045; Anno Domini MDLXIV &#10045;</div>

  <div class="card">
    <label class="card-label" for="input"><span class="icon">&#9998;</span> Modern English</label>
    <textarea id="input" placeholder="Type thy modern words here, good merchant..."></textarea>
    <div class="char-count"><span id="charCount">0</span> characters inscribed</div>
  </div>

${optionsHtml}

  <div class="btn-row">
    <button class="btn btn-primary" id="go">
      <span class="quill-icon">&#128396;</span> Repraise In All Styles!
    </button>
    <button class="btn btn-secondary" id="clear">Clear</button>
  </div>

  <span class="visually-hidden" id="dashStatus" role="status"></span>

  <div class="grid">
${cards}
  </div>

${savedQuotesHtml}

  <div class="footer">
    <span class="quill-small">&#128396;</span>
    Crafted with ink &amp; devotion
    <span class="quill-small">&#128396;</span>
  </div>
</div>

<span class="visually-hidden" id="copyStatus" role="status"></span>

${cardModalHtml}

<script>
/* GENERATED by tools/build-dashboard.mjs - do not edit by hand.
   Each style below is that page's own dictionaries, engine, helpers and main
   function copied verbatim, so this file cannot drift from the style pages.
   Run: node tools/build-dashboard.mjs */
const STYLES = {};
${modules}
${quotecard}
${cardui}
${savedQuotesJs}
${compareJs}
${optionsJs}

(function () {
  const ORDER = ${JSON.stringify(STYLES.map((s) => s.id))};
  const inputEl = document.getElementById('input');
  const charCountEl = document.getElementById('charCount');
  const statusEl = document.getElementById('dashStatus');
  const copyStatusEl = document.getElementById('copyStatus');
  const outs = ORDER.map((id) => document.getElementById('out-' + id));

  // Advances per run so repeat clicks differ, as on the individual pages.
  let baseSeed = (Math.random() * 0x100000000) >>> 0;

  inputEl.addEventListener('input', () => {
    charCountEl.textContent = inputEl.value.length;
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      transformAll();
    }
  });

  document.getElementById('go').addEventListener('click', transformAll);
  document.getElementById('clear').addEventListener('click', () => {
    inputEl.value = '';
    charCountEl.textContent = '0';
    outs.forEach((o) => { o.textContent = ''; });
    closeCard();
    statusEl.textContent = 'Cleared';
  });

  // Saved-quote Re-run: regenerate just this style's card from the stored
  // original and settings, leaving the other five untouched. sqRerun has
  // already restored #input and the settings controls before calling this.
  window.sqTransformHook = function (item) {
    const id = String(item.style || '').toLowerCase();
    const idx = ORDER.indexOf(id);
    if (idx < 0 || !item.original) return;
    outs[idx].textContent = STYLES[id].transform(
      item.original, (Math.random() * 0x100000000) >>> 0);
  };

  // ---------- quote card ----------
  // Wiring lives in tools/cardui.js, shared with any other page that offers
  // "Make Card".
  const cardUI = initCardUI({ emptyMessage: 'Transform some text first' });
  const closeCard = cardUI.close;

  document.querySelectorAll('[data-card]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.card;
      cardUI.open(id, document.getElementById('out-' + id).textContent, btn,
        inputEl.value);
    });
  });

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = document.getElementById('out-' + btn.dataset.copy).textContent;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '<span>&#10003;</span> Copied!';
        btn.classList.add('copied');
        copyStatusEl.textContent = 'Copied to clipboard';
        setTimeout(() => {
          btn.innerHTML = '<span>&#128203;</span> Copy';
          btn.classList.remove('copied');
          copyStatusEl.textContent = '';
        }, 2000);
      });
    });
  });

  function transformAll() {
    const text = inputEl.value;
    if (!text.trim()) {
      statusEl.textContent = 'Enter some text first';
      inputEl.focus();
      return;
    }
    baseSeed = (baseSeed + 0x9E3779B9) >>> 0;
    ORDER.forEach((id, i) => {
      outs[i].textContent = STYLES[id].transform(text, (baseSeed + i) >>> 0);
    });
    statusEl.textContent = ORDER.length + ' styles transformed';
  }
})();
</script>
</body>
</html>
`;

const dest = join(ROOT, 'index.html');
// Normalise to LF. The style modules are copied verbatim from the style pages, so
// without this the output would inherit whatever line endings the checkout had,
// and the same commit could rebuild differently on Windows and on CI.
writeFileSync(dest, out.replace(/\r\n/g, '\n'));
console.log(`wrote index.html, ${(out.length / 1024).toFixed(0)} KB`);
