// Captures transform output for every page x corpus entry x seed.
//   node tools/snapshot.mjs            -> writes tools/baseline.json
//   node tools/snapshot.mjs out.json

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { CORPUS, SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  { file: 'shakespeare.html', entry: 'shakespearify' },
  { file: 'pirate.html', entry: 'pirateify' },
  { file: 'victorian.html', entry: 'victorianify' },
  { file: 'chaucer.html', entry: 'chaucerify' },
  { file: 'yoda.html', entry: 'yodaify' },
  { file: 'norse.html', entry: 'norseify' },
];

const out = {};
let cases = 0;

for (const { file, entry } of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  out[file] = { seedable: page.has('seedRandom'), results: {} };

  for (const input of CORPUS) {
    for (const seed of SEEDS) {
      out[file].results[`${seed}::${input}`] = page.transform(input, seed);
      cases++;
    }
  }

  const ruleCounts = ['sentenceTransforms', 'contractions', 'pronouns', 'verbForms',
    'commonWords', 'verbs', 'adjectives', 'nouns'].reduce((acc, n) => {
      if (page.api[n]) acc[n] = page.api[n].length;
      return acc;
    }, {});
  out[file].ruleCounts = ruleCounts;
  out[file].negativeCount = page.api.negatives ? Object.keys(page.api.negatives).length : 0;

  console.log(
    `${file.padEnd(18)} rules=${String(
      Object.values(ruleCounts).reduce((a, b) => a + b, 0) + out[file].negativeCount
    ).padStart(4)}  negatives=${String(out[file].negativeCount).padStart(3)}  ` +
    `seedable=${out[file].seedable}`
  );
}

const dest = process.argv[2] || join(ROOT, 'tools', 'baseline.json');
writeFileSync(dest, JSON.stringify(out, null, 1));
console.log(`\n${cases} cases -> ${dest}`);
