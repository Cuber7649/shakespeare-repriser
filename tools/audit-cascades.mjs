// Finds rules whose REPLACEMENT text is itself a match key in the same
// dictionary. Under the old sequential chain these apply twice, so the
// replacement you see in the browser is not the one written in the word list.
//   node tools/audit-cascades.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { CHAIN_NAMES } from './engine-proto.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  ['shakespeare.html', 'shakespearify'],
  ['pirate.html', 'pirateify'],
  ['victorian.html', 'victorianify'],
  ['chaucer.html', 'chaucerify'],
  ['yoda.html', 'yodaify'],
  ['norse.html', 'norseify'],
];

const PURE = /^\\b([A-Za-z0-9_'’ \t-]+)\\b$/;
const lit = (pat) => (typeof pat === 'string' ? pat : (PURE.exec(pat.source)?.[1] ?? null));

let total = 0;

for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);

  // every key that can be matched, per dictionary
  const keysPerDict = {};
  for (const name of CHAIN_NAMES) {
    const dict = page.api[name];
    if (!dict) continue;
    const pairs = Array.isArray(dict) ? dict : Object.entries(dict);
    const m = new Map();
    for (const [pat, rep] of pairs) {
      const l = lit(pat);
      if (l) m.set(l.toLowerCase(), String(rep));
    }
    keysPerDict[name] = m;
  }

  const hits = [];
  for (const name of CHAIN_NAMES) {
    const dict = page.api[name];
    if (!dict) continue;
    const pairs = Array.isArray(dict) ? dict : Object.entries(dict);
    for (const [pat, rep] of pairs) {
      if (typeof rep !== 'string' || !rep.trim()) continue;
      const target = keysPerDict[name].get(rep.trim().toLowerCase());
      if (target !== undefined) {
        hits.push({ name, from: lit(pat) ?? String(pat), mid: rep, to: target });
      }
    }
  }

  if (hits.length) {
    total += hits.length;
    console.log(`\n${'='.repeat(74)}\n${file}   ${hits.length} double-apply chain(s)\n`);
    for (const h of hits) {
      console.log(`  ${h.name}`);
      console.log(`      ${JSON.stringify(h.from).padEnd(20)} -> ${JSON.stringify(h.mid)} -> ${JSON.stringify(h.to)}`);
      console.log(`      old engine output: ${JSON.stringify(h.to)}    list intends: ${JSON.stringify(h.mid)}`);
    }
  }
}

console.log(`\n${'='.repeat(74)}\nTOTAL double-apply chains: ${total}`);
