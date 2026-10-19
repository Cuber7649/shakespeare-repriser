// Paste the shared blocks from tools/ into the six style pages -- and check
// them for drift.
//
//   node tools/paste-shared.mjs           repaste whatever drifted, then rebuild index.html
//   node tools/paste-shared.mjs --check   verify only; exit 1 on drift (never writes)
//
// Each style page is a standalone app, so it carries a VERBATIM copy of the 13
// shared blocks that live in tools/ (six JS, four CSS, three HTML). Content is
// compared after CRLF normalisation, but splices go through a raw-offset map so
// a page's mixed line endings and its own separator spacing survive untouched:
// a page that is already in sync is never rewritten.
//
// Regions are delimited structurally. The JS and CSS chains run from a block's
// first line to the next block's first line (last of a chain: the closing tag),
// so the separator whitespace between blocks stays under the page's control and
// is re-emitted as a raw gap. The HTML blocks are tight: each ends at its own
// closing tag (the modal: its status span), and everything between regions --
// footer, indents, blank lines -- is never touched.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { browserSource } from './page-source.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const CHECK = process.argv.slice(2).includes('--check');

const PAGES = ['shakespeare.html', 'pirate.html', 'victorian.html',
  'chaucer.html', 'yoda.html', 'norse.html'];

const norm = (s) => s.replace(/\r\n/g, '\n');
const rd = (f) => readFileSync(join(ROOT, f), 'utf8');

const CHAINS = [
  {
    close: '</script>',
    files: ['options.js', 'savedquotes.js', 'compare.js', 'quotecard.js',
      'cardui.js', 'cardpage.js', 'surprise.js'],
    load: (f) => norm(browserSource(rd(`tools/${f}`))),
  },
  {
    close: '</style>',
    files: ['card-modal.css', 'options.css', 'compare.css', 'savedquotes.css'],
    load: (f) => norm(rd(`tools/${f}`)),
  },
];

// The modal owns its status span: everything from <div id="cardModal"> through
// the last </span> before the page's script tag (a duplicated span therefore
// sits inside the region and is repaired with it).
const closeAfter = (nrm, start, tag) => {
  const at = nrm.indexOf(tag, start);
  return at < 0 ? -1 : at + tag.length;
};
const modalEnd = (nrm, start) => {
  const script = nrm.indexOf('<script', start);
  const span = script < 0 ? -1 : nrm.lastIndexOf('</span>', script);
  return span < start ? -1 : span + '</span>'.length;
};
const HTML_BLOCKS = [
  ['options.html', (n, s) => closeAfter(n, s, '</fieldset>')],
  ['savedquotes.html', (n, s) => closeAfter(n, s, '</section>')],
  ['card-modal.html', modalEnd],
];
const BLOCK_COUNT = CHAINS.reduce((n, c) => n + c.files.length, 0)
  + HTML_BLOCKS.length;

// norm-offset -> raw-offset map. norm() only deletes the \r of each \r\n pair,
// so walking the raw bytes once gives every norm position its raw twin.
function normToRaw(raw) {
  const map = new Array(raw.length + 1);
  let n = 0;
  let r = 0;
  while (r < raw.length) {
    if (raw.charCodeAt(r) === 13 && raw.charCodeAt(r + 1) === 10) {
      map[n++] = r + 1; // the \n of the pair
      r += 2;
    } else {
      map[n++] = r;
      r += 1;
    }
  }
  map[n] = raw.length;
  return map;
}

// Find where a block's first line begins in the page. Matching is on the
// trimmed line (so a page may indent the block differently than the source),
// and the block's own leading indent is part of the region it owns.
function locateAnchor(nrm, block, name) {
  const first = block.split('\n')[0];
  const key = first.trim();
  const aLead = first.match(/^\s*/)[0].length;
  const lines = nrm.split('\n');
  const hits = [];
  let off = 0;
  for (const L of lines) {
    if (L.trim() === key) hits.push([off, L]);
    off += L.length + 1;
  }
  if (hits.length !== 1) {
    return {
      err: `${name}: anchor ${JSON.stringify(key.slice(0, 60))} matched `
        + `${hits.length} lines (want exactly 1)`,
    };
  }
  const [lineStart, L] = hits[0];
  const lLead = L.match(/^\s*/)[0].length;
  if (lLead < aLead || !nrm.startsWith(first.trimEnd(), lineStart + (lLead - aLead))) {
    return { err: `${name}: anchor line found but block start does not line up` };
  }
  return { start: lineStart + (lLead - aLead) };
}

// Locate every region in one page: [start, end) with the raw gap (separator
// whitespace) that ends each region.
function regionsOf(page, raw) {
  const nrm = norm(raw);
  const map = normToRaw(raw);
  const regions = [];
  const errors = [];

  for (const chain of CHAINS) {
    const blocks = chain.files.map((f) => [f, chain.load(f)]);
    const starts = blocks.map(([f, block]) => {
      const a = locateAnchor(nrm, block, f);
      if (a.err) errors.push(`${page}: ${a.err}`);
      return a.start;
    });
    if (errors.length) return { errors };
    const last = starts.length - 1;
    const end = nrm.indexOf(chain.close, starts[last]);
    if (end < 0) {
      errors.push(`${page}: closing ${chain.close} not found after ${blocks[last][0]}`);
      return { errors };
    }
    for (let i = 0; i <= last; i++) {
      const regionEnd = i < last ? starts[i + 1] : end;
      const block = blocks[i][1];
      let gapStart = regionEnd;
      while (gapStart > starts[i] && /\s/.test(nrm[gapStart - 1])) gapStart--;
      regions.push({
        name: blocks[i][0],
        start: starts[i],
        end: regionEnd,
        gapStart,
        block: block.trimEnd(),
      });
    }
  }

  for (const [file, endAt] of HTML_BLOCKS) {
    const block = norm(rd(`tools/${file}`));
    const a = locateAnchor(nrm, block, file);
    if (a.err) {
      errors.push(`${page}: ${a.err}`);
      return { errors };
    }
    const regionEnd = endAt(nrm, a.start);
    if (regionEnd < 0) {
      errors.push(`${page}: closing markup for ${file} not found`);
      return { errors };
    }
    let gapStart = regionEnd;
    while (gapStart > a.start && /\s/.test(nrm[gapStart - 1])) gapStart--;
    regions.push({
      name: file,
      start: a.start,
      end: regionEnd,
      gapStart,
      block: block.trimEnd(),
    });
  }

  regions.sort((a, b) => a.start - b.start);
  for (let i = 1; i < regions.length; i++) {
    if (regions[i].start < regions[i - 1].end) {
      errors.push(`${page}: regions overlap at ${regions[i].name}`);
      return { errors };
    }
  }
  for (const r of regions) {
    if (r.end <= r.start) errors.push(`${page}: empty region for ${r.name}`);
  }
  if (errors.length) return { errors };

  for (const r of regions) {
    r.gapRaw = raw.slice(map[r.gapStart], map[r.end]);
    r.expected = r.block + norm(r.gapRaw);
    r.dirty = nrm.slice(r.start, r.end) !== r.expected;
    r.replacement = r.block + r.gapRaw;
  }
  return { regions, map, nrm };
}

function firstDiff(a, b) {
  let d = 0;
  while (d < a.length && d < b.length && a[d] === b[d]) d++;
  return d;
}

const ctx = (s, d) => JSON.stringify(
  s.slice(Math.max(0, d - 30), d + 50));

let failed = false;
let wrote = 0;
const fixedLines = [];

for (const page of PAGES) {
  const raw = rd(page);
  const { regions, map, nrm, errors } = regionsOf(page, raw);
  if (errors && errors.length) {
    failed = true;
    for (const e of errors) console.log(`  BAD   ${e}`);
    continue;
  }
  const dirty = regions.filter((r) => r.dirty);
  if (!dirty.length) continue;

  if (CHECK) {
    failed = true;
    for (const r of dirty) {
      const content = nrm.slice(r.start, r.end);
      const d = firstDiff(content, r.expected);
      console.log(`  BAD   ${page}: ${r.name} drifted (first diff at ${d})`);
      console.log(`        page:   ${ctx(content, d)}`);
      console.log(`        source: ${ctx(r.expected, d)}`);
    }
    continue;
  }

  let out = '';
  let cursor = 0;
  for (const r of dirty) {
    out += raw.slice(cursor, map[r.start]) + r.replacement;
    cursor = map[r.end];
  }
  out += raw.slice(cursor);
  writeFileSync(join(ROOT, page), out);
  wrote++;
  fixedLines.push(`${page}: ${dirty.map((r) => r.name).join(', ')}`);
}

if (CHECK) {
  if (failed) {
    console.log('\npaste-shared --check failed: pages drifted from tools/.');
    console.log('Run: node tools/paste-shared.mjs');
    process.exit(1);
  }
  console.log(`${BLOCK_COUNT} blocks x ${PAGES.length} pages in sync with tools/`);
  process.exit(0);
}

if (failed) process.exit(1);
for (const line of fixedLines) console.log(`pasted ${line}`);
if (!wrote) {
  console.log(`${BLOCK_COUNT} blocks x ${PAGES.length} pages already in sync`);
  process.exit(0);
}
const build = spawnSync(process.execPath, [join(HERE, 'build-dashboard.mjs')],
  { cwd: ROOT, stdio: 'inherit' });
if (build.status !== 0) {
  console.log('build-dashboard failed after pasting');
  process.exit(1);
}
console.log(`rebuilt index.html (${wrote} page(s) updated)`);
