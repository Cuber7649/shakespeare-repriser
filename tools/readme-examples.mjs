// Generates real output for every example in README.md so the docs can be
// checked against actual behaviour instead of remembered behaviour.
//   node tools/readme-examples.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = {
  shakespeare: ['shakespeare.html', 'shakespearify'],
  pirate: ['pirate.html', 'pirateify'],
  victorian: ['victorian.html', 'victorianify'],
  chaucer: ['chaucer.html', 'chaucerify'],
  yoda: ['yoda.html', 'yodaify'],
  norse: ['norse.html', 'norseify'],
};

// The "Styles" table: short fragments, quoted in the README.
const FRAGMENTS = [
  ['shakespeare', 'how are you'],
  ['pirate', 'you are my friend'],
  ['victorian', 'really'],
  ['victorian', 'you are'],
  ['chaucer', 'you are happy'],
  ['norse', 'you are happy'],
];

// The "Examples" table: full inputs, quoted in the README.
const EXAMPLES = [
  ['hello how are you today', 'shakespeare'],
  ['hello how are you today', 'pirate'],
  ['hello how are you today', 'chaucer'],
  ['hello how are you today', 'norse'],
  ['I am so happy to see my friend', 'pirate'],
  ['I am so happy to see my friend', 'chaucer'],
  ['we will travel tomorrow and find the treasure', 'victorian'],
  ['we will travel tomorrow and find the treasure', 'norse'],
  ['you are brave', 'yoda'],
];

const SEEDS = [1, 2, 3, 7, 42, 1337];

function run(which, input) {
  const [file, entry] = PAGES[which];
  const page = loadPage(join(ROOT, file), entry);
  return SEEDS.map((s) => {
    const out = page.transform(input, s);
    return { seed: s, out: out.replace(/\s+/g, ' ').trim() };
  });
}

const cache = new Map();
function memo(which, input) {
  const k = `${which}::${input}`;
  if (!cache.has(k)) cache.set(k, run(which, input));
  return cache.get(k);
}

console.log('\n=== FRAGMENTS (Styles table) ===');
for (const [which, input] of FRAGMENTS) {
  const outs = memo(which, input);
  const uniq = [...new Set(outs.map((o) => o.out))];
  console.log(`\n${which}  <-  ${JSON.stringify(input)}`);
  console.log(`  distinct outputs across ${SEEDS.length} seeds: ${uniq.length}`);
  for (const u of uniq.slice(0, 4)) console.log(`    ${JSON.stringify(u)}`);
}

console.log('\n\n=== EXAMPLES (Examples table) ===');
for (const [input, which] of EXAMPLES) {
  const outs = memo(which, input);
  const uniq = [...new Set(outs.map((o) => o.out))];
  console.log(`\n${which}  <-  ${JSON.stringify(input)}`);
  console.log(`  distinct outputs across ${SEEDS.length} seeds: ${uniq.length}`);
  for (const o of outs) console.log(`    seed ${String(o.seed).padStart(4)}: ${JSON.stringify(o.out)}`);
}
