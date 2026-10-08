// Locates exactly which pipeline step introduces a fused comma (",word").
//   node tools/find-fusion.mjs [page] [input]

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = {
  shakespeare: ['shakespeare.html', 'shakespearify'],
  pirate: ['pirate.html', 'pirateify'],
  victorian: ['victorian.html', 'victorianify'],
  chaucer: ['chaucer.html', 'chaucerify'],
  yoda: ['yoda.html', 'yodaify'],
  norse: ['norse.html', 'norseify'],
};

const which = process.argv[2] || 'pirate';
const fixedInput = process.argv[3];
const [file, entry] = PAGES[which];
const page = loadPage(join(ROOT, file), entry);
const a = page.api;

const FUSE = /[a-z],[a-z]/;

function cleanups(text) {
  return [
    ['space-before-punct', () => text.replace(/\s+([.,!?;:])/g, '$1')],
    ['comma-collapse', () => text.replace(/,\s*,/g, ',')],
    ['double-dot', () => text.replace(/\.\s*\./g, '.')],
    ['double-excl', () => text.replace(/!\s*!/g, '!')],
    ['double-quest', () => text.replace(/\?\s*\?/g, '?')],
    ['capitalise-i', () => text.replace(/\bi\b/g, 'I')],
    ['sentence-caps', () => text.replace(/(^\s*|[.!?]+\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase())],
    ['double-space', () => text.replace(/  +/g, ' ')],
  ];
}

const inputs = fixedInput ? [fixedInput] : null;
let found = 0;

for (const seed of SEEDS) {
  a.seedRandom(seed);
  const text = inputs
    ? inputs[0]
    : 'Hello! How are you? Fine, thanks.';
  const sentences = text.match(/[^.!?]*[.!?]+|[^.!?]+/g) || [text];
  const result = [];

  for (const raw of sentences) {
    let s = raw.trim();
    if (!s) continue;
    const log = [];
    const step = (name, fn) => { const nx = fn(s); log.push([name, s, nx]); s = nx; };

    step('replaceAll', () => a.replaceAll(s));
    step('invert', (x) => a.maybeInvert(x));
    step('filler', (x) => a.maybeAddFiller(x));
    step('metaphor', (x) => a.maybeAddMetaphor(x));
    step('allit', (x) => a.maybeAddAlliteration(x));
    step('paren', (x) => a.maybeAddParenthetical(x));
    step('insult', (x) => a.maybeInsertInsult(x));
    step('opening', (x) => (a.chance(0.35) ? a.pick(a.openings) + ' ' + x : x));
    step('midIns', (x) => {
      if (a.chance(0.20)) {
        const c = x.indexOf(',');
        if (c > 0 && c < x.length - 5) {
          const after = x.substring(c + 1).replace(/^\s+/, '');
          return x.substring(0, c) + a.pick(a.midInsertions) + (after ? ' ' + after : '');
        }
      }
      return x;
    });

    if (/\s,/.test(s) || FUSE.test(s)) {
      console.log(`\nseed ${seed} sentence ${JSON.stringify(raw)}`);
      for (const [name, before, after] of log) {
        const mark = after !== before ? ' *' : '';
        console.log(`  ${name.padEnd(11)} ${JSON.stringify(after)}${mark}`);
      }
    }
    result.push(s);
  }

  let joined = result.join(' ');
  const perSentence = joined;
  joined = a.maybeInsertQuote(joined);
  joined = a.maybeAddAside(joined);
  joined = a.maybeAddStageDirection(joined);
  const beforeCleanups = joined;

  let text2 = joined;
  for (const [name, fn] of cleanups(text2)) {
    const had = FUSE.test(text2);
    const next = fn();
    if (FUSE.test(next) && !had) {
      console.log(`seed ${seed}: FUSED AT cleanup "${name}"`);
      console.log(`  per-sentence : ${JSON.stringify(perSentence)}`);
      console.log(`  before clean : ${JSON.stringify(beforeCleanups)}`);
      console.log(`  after        : ${JSON.stringify(next)}`);
      found++;
      break;
    }
    text2 = next;
  }
  if (!found && FUSE.test(text2)) {
    console.log(`seed ${seed}: fused already in per-sentence output`);
    console.log(`  ${JSON.stringify(perSentence)}`);
    found++;
  }
  if (found) break;
}

if (!found) console.log('no fused comma reproduced across seeds');
