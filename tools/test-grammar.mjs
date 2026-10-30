// Grammar regression gate: the rest of the suite proves the engine is
// deterministic and covers its edge cases, but not that the rewrite is
// grammatical. These checks are pattern-based on purpose: exact strings would
// break whenever `pick()` shifts, while these shapes should never be produced
// by any style, input or seed.
//   node tools/test-grammar.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';
import { CORPUS, SEEDS } from './corpus.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  ['shakespeare.html', 'shakespearify'],
  ['pirate.html', 'pirateify'],
  ['victorian.html', 'victorianify'],
  ['chaucer.html', 'chaucerify'],
  ['yoda.html', 'yodaify'],
  ['norse.html', 'norseify'],
];

// The shapes reported in the 2026-10-20 review. Each one is a defect no
// legitimate rule can produce; a hit means a table or helper regressed.
const BANNED = [
  {
    id: 'object-pronoun',
    re: /\b(?:behold|beholdeth|love|loven|loveth|adore|see|seen|help|helpeth|thank|thanketh|tell|give|show|bring|find|let|meet|hear|call|ask|need|want|know|serve|obey|follow|trust|believe|teach|kiss|embrace|greet|welcome|praise|blame|forgive|remember|forget|protect|save|join|leave|take|hold|choose|command|bid|pray|beseech|entreat|vex|mock|scorn|hate|fear|envy|strike|kill|wound|heal|send|carry|lead|feed|clothe|arm|shield|defend|attend|await|seek|visit|court|wed|marry|cherish|revere|honour|honor|delight|please|amuse|comfort|warn|advise|remind|inform|convince|persuade|tempt|test|try|watch|observe|perceive|regard|notice|recognize|admire|despise|loathe|curse|bless|reward|punish|arrest|release|free|bind|tie|cut|stab|beat|hit|push|pull|drag|lift|raise|drop|catch|throw|sell|buy|pay|owe|cost|offer|receive|accept|refuse|deny|grant|allow|permit|forbid|stop|keep|set|put|make|miss|saw|gave|told|brought|found|heard|made|took|held|chose|struck|sent|led|fed|sought|sold|bought|paid|caught|threw|knew|forgot|forgave|besought|bound|left|kept|met|spoke|said|shown|beheld|beaten)\s+thou\b/i,
    why: 'object pronoun uses the subject form (thou)',
  },
  {
    id: 'preposition-pronoun',
    re: /\b(?:to|for|with|by|from|of|on|in|at|about|upon|unto|into|through|throughout|without|within|against|toward|towards|behind|before|after|near|over|under|between|betwixt|among|amongst|around|beyond|beneath|till|until|via|per|like|than)\s+thou\b/i,
    why: 'pronoun after a preposition uses the subject form (thou)',
  },
  {
    id: 'thee-subject',
    re: /\bthee\s+(?:art|dost|hast|wilt|shalt|canst|wouldst|shouldst|didst|wast|wert|is|are)\b/i,
    why: 'object pronoun used as the subject',
  },
  {
    id: 'i-doth',
    re: /\bI\s+doth\b/i,
    why: 'first person takes do, not doth',
  },
  {
    id: 'subject-doth',
    re: /\b(?:we|they|I)\s+(?:doth|hath)\b/i,
    why: 'plural or first-person subject takes do/have, not doth/hath',
  },
  {
    id: 'thou-doth',
    re: /\bthou\s+(?:doth|hath)\b/i,
    why: 'thou takes dost/hast',
  },
  {
    id: 'third-person-dost',
    re: /\b(?:he|she|it|we|they|I)\s+(?:dost|hast|art|wast|wert|canst)\b/i,
    why: 'verb form disagrees with the subject',
  },
  {
    id: 'thou-plural',
    re: /\bthou\s+(?:is|are|was|were)\b/i,
    why: 'thou takes art/wast/wert',
  },
  {
    id: 'doubled-intensifier',
    re: /\b(?:most|exceedingly|very|right|passing|utterly|wholly|truly)\s+(?:most|exceedingly|very|right|passing|utterly|wholly|truly)\b/i,
    why: 'two intensifiers on one word',
  },
  {
    id: 'unpunctuated-interjection',
    re: /\b(?:by my troth|forsooth|verily|marry|good sooth|in good sooth|as I live)\s+[A-Z]/,
    why: 'interjection runs into the next word without punctuation',
  },
  {
    id: 'filler-in-noun-phrase',
    re: /\b(?:the|a|an|my|your|thy|his|her|their|our)\s+(?:by my troth|in good sooth|good sooth|forsooth|verily|in faith|as I live|methinks)\b/i,
    why: 'filler split a determiner from its noun',
  },
  {
    id: 'filler-after-aux',
    re: /\b(?:is|are|was|were|will|would|can|could|shall|should|do|does|did|has|have|had)\s+(?:by my troth|in good sooth|forsooth|as I live|methinks)\s+\w/i,
    why: 'filler split an auxiliary from its verb',
  },
  {
    id: 'doubled-insert',
    re: /\b(?:by my troth|in good sooth|good sooth|forsooth|verily|as I live|by the gods|by Odin|by Thor)[!,][^.!?]{0,40}\b(?:by my troth|in good sooth|good sooth|forsooth|verily|as I live|by the gods|by Odin|by Thor)[!,]/i,
    why: 'two interjections stacked in one sentence',
  },
];

const AUX = 'am|art|is|are|was|were|has|have|had|does|do|did|will|would|could|should|shall|may|might|must|can';
const SUBJ = 'I|you|he|she|it|we|they|thou|ye';
// Only conjunctions count. A leading interjection followed by a comma is a
// separate opening, and the main clause after it may be fronted legitimately.
const CONJ = /\b(?:and|but|because|although|though|while|whilst|yet)\b/i;
const INVERTED = new RegExp(`^(?:${AUX})\\s+(?:${SUBJ})\\b`, 'i');

// A clause introduced by a conjunction must keep its subject before the verb:
// "and will we ..." is the exact shape a whole-sentence inversion produces.
function crossedInversion(sentence) {
  const parts = sentence.split(CONJ);
  return parts.slice(1).some((p) => INVERTED.test(p.trim()));
}

let failures = 0;
let checked = 0;

for (const [file, entry] of PAGES) {
  const page = loadPage(join(ROOT, file), entry);
  const hits = new Map();
  const samples = new Map();

  for (const input of CORPUS) {
    for (const seed of SEEDS) {
      const out = page.transform(input, seed);
      checked++;

      for (const rule of BANNED) {
        if (!rule.re.test(out)) continue;
        hits.set(rule.id, (hits.get(rule.id) || 0) + 1);
        if (!samples.has(rule.id)) samples.set(rule.id, { input, seed, out });
      }

      for (const sentence of out.match(/[^.!?]*[.!?]+|[^.!?]+/g) || [out]) {
        if (!crossedInversion(sentence)) continue;
        hits.set('crossed-inversion', (hits.get('crossed-inversion') || 0) + 1);
        if (!samples.has('crossed-inversion')) samples.set('crossed-inversion', { input, seed, out });
      }
    }
  }

  const total = [...hits.values()].reduce((a, b) => a + b, 0);
  if (total) failures += total;
  console.log(`  ${total ? 'FAIL' : 'ok  '}  ${file.padEnd(18)} ${total} hit(s)`);
  for (const [id, count] of hits) {
    const label = (BANNED.find((r) => r.id === id) || {}).why || id;
    const s = samples.get(id);
    console.log(`        ${id} x${count}: ${label}`);
    console.log(`          seed ${s.seed} ${JSON.stringify(s.input)}`);
    console.log(`          -> ${JSON.stringify(s.out)}`);
  }
}

console.log(
  failures
    ? `\n${failures} grammar hit(s) across ${checked} outputs`
    : `\nevery grammar check passed across ${checked} outputs`
);
process.exitCode = failures ? 1 : 0;
