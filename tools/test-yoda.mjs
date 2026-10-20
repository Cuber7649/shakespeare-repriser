// Yoda transform gate: object fronting, infinitive fronting, the strict
// object guard, and the word-table rules that used to garble reordered
// sentences. Everything runs through the page's own yodaify() with a fixed
// seed, so a failure here is a real behaviour change, not RNG drift.
//   node tools/test-yoda.mjs

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPage } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const yoda = loadPage(join(ROOT, 'yoda.html'), 'yodaify');

const SEED = 42;
let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  FAIL  ${m}`); failures++; };

// --- exact outputs (seed 42) -------------------------------------------------

console.log('\nexact outputs (seed 42)');

const EXACT = [
  ['I like pie', 'Pie, I like'],
  ['I love the bright sun', 'The bright sun, I love'],
  ['he whispered a terrible secret', 'A terrible secret, he whispered'],
  ['the old king ruled the land', 'The land, the ancient king ruled'],
  ['you are brave', 'Brave, you are'],
  ['I want to find the lost treasure.', 'To find the lost treasure, I want.'],
  ['You need to leave the old temple.', 'To depart the ancient temple, you need.'],
];

for (const [input, want] of EXACT) {
  const got = yoda.transform(input, SEED);
  if (got === want) ok(`${JSON.stringify(input)} -> ${JSON.stringify(got)}`);
  else no(`${JSON.stringify(input)}\n        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`);
}

// --- grammar gate: optional flourishes off -----------------------------------
// Reordering is exercised with every optional addition disabled, so these
// assertions describe the core transformation rather than RNG taste.

console.log('\ngrammar gate (seed 42, optional additions off)');

const OPT_IDS = ['optOpenings', 'optMetaphors', 'optAsides', 'optInvert'];
for (const id of OPT_IDS) yoda.document.getElementById(id).checked = false;

const CORE = [
  // Copular fronting: true copulas only, subject case normalised.
  ['You are strong.', 'Powerful, you are.'],
  ['The sky is blue.', 'Blue, the sky is.'],
  ['The old king ruled the land.', 'The land, the ancient king ruled.'],
  ['The Sith are dangerous.', 'Dangerous, the Sith are.'],
  ['His anger is dangerous.', 'Dangerous, his anger is.'],
  ['The greatest teacher is failure.', 'Failure, the greatest teacher is.'],
  ['He is a great warrior.', 'A great warrior, he is.'],
  ['It is a trap.', 'A trap, it is.'],
  ['I am afraid of the dark side.', 'Afraid of the dark side, I am.'],

  // Negation and wh-complements must not be fronted.
  ['Death is not the end.', 'Death is not the end.'],
  ['It is what it is.', 'It is what it is.'],
  ['The question is whether we should go.', 'The question is whether we should go.'],
  ['The problem is that we are late.', 'The problem is that we are late.'],
  ['It is how we learn.', 'It is how we learn.'],
  ['This is the way.', 'This is the way.'],

  // Modal/auxiliary + verb is not an SVO object.
  ['She will heal him.', 'She will heal him.'],
  ['You should rest.', 'You should rest.'],
  ['You cannot escape.', 'You cannot escape.'],
  ['I will not fail.', 'I will not fail.'],

  // Subordinate clauses keep their own order.
  ['When you are ready, we will leave.', 'When you are ready, we will depart.'],
  ['The book that you are reading is old.', 'The tome that you are reading is ancient.'],
  ['When you reach 900 years old, you will not look as good.',
    'When you reach 900 years old, you will not look as good.'],

  // SVO fronting still works; the subject keeps proper-noun case.
  ['I want peace.', 'Peace, I want.'],
  ['I love life.', 'Life, I love.'],
  ['The Jedi protect the galaxy.', 'The galaxy, the Jedi protect.'],
  ['A Jedi uses the Force.', 'The Force, a Jedi uses.'],
  ['Luke destroys the Death Star.', 'The Death Star, Luke destroys.'],
  ['Tell me the truth.', 'Tell me the truth.'],
  ['Look at the stars.', 'Look at the stars.'],
  ['I think you will like it.', 'You will like it, I consider.'],
  ['I know you are strong.', 'You are powerful, I comprehend.'],
  ['She believes you will win.', 'You will triumph, she believes.'],
  ['She said you are kind.', 'You are kind, she said.'],
  ['Few know the truth.', 'The truth, few comprehend.'],

  // Four-word subjects ending in a noun are parsed correctly; subjects with
  // an internal prepositional phrase are not mistaken for subject + verb.
  ['A powerful Sith lord rules the galaxy.', 'The galaxy, a powerful Sith lord rules.'],
  ['The dark armored warrior wielded a red blade.',
    'A red blade, the dark armored warrior wielded.'],
  ['The brave young Jedi fought the dark lord.',
    'The dark lord, the brave young Jedi fought.'],
  ['A tall dark stranger entered the tavern.',
    'The tavern, a tall dark stranger entered.'],
  ['The wise old woman told a story.', 'A story, the wise ancient woman told.'],
  ['A small green creature trained the boy.',
    'The boy, a small green creature trained.'],
  ['The knight in shining armor drew his sword.',
    'The knight in shining armor drew his blade.'],
  ['The girl with the dragon tattoo smiled.', 'The girl with the dragon tattoo smiled.'],
  ['The leader of the free world spoke to the crowd.',
    'The leader of the free world spoke to the crowd.'],
  ['A group of brave warriors attacked the fortress.',
    'A group of brave warriors struck the fortress.'],
  ['The man in the high castle wrote a book.', 'The man in the high castle wrote a tome.'],

  // Word-table regressions: nouns and proper nouns stay intact.
  ['May the Force be with you.', 'May the Force be with you.'],
  ['The Force is strong with you.', 'Strong with you, the Force is.'],
  ['We are strong in the Force.', 'Strong in the Force, we are.'],
  ['Nobody is perfect.', 'Perfect, no one is.'],
  ['All is lost.', 'Lost, all is.'],
  ['I have a bad feeling about this.', 'I have a dark feeling about this.'],

  // Phrase tables: "years old", "happy to", negative contractions.
  ['I am very happy to see you.', 'Very glad to perceive you, I am.'],
  ['I have to go.', 'I must go.'],
  ["I shouldn't go.", 'Go, I should not.'],
  ["You can't escape.", 'You cannot escape.'],
  ['There is no try.', 'No try, there is.'],
  ['There are no ghosts.', 'No ghosts, there are.'],
  ['Do or do not. There is no try.', 'Do or do not. No try, there is.'],

  // Existing structural limits still hold.
  ['I want to find the really big treasure today',
    'I want to find the truly great treasure today'],
  ['The dog wants to chase the cat.', 'The dog wants to pursue the cat.'],
  ['The dog chased the cat up the tree.', 'The dog pursued the cat up the tree.'],
];

for (const [input, want] of CORE) {
  const got = yoda.transform(input, SEED);
  if (got === want) ok(`${JSON.stringify(input)} -> ${JSON.stringify(got)}`);
  else no(`${JSON.stringify(input)}\n        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`);
}

for (const id of OPT_IDS) yoda.document.getElementById(id).checked = true;

// --- the object guard refuses these ------------------------------------------

console.log('\nobject guard (seed 42)');

// A prepositional phrase inside the object: nothing may be fronted.
{
  const out = yoda.transform('The dog chased the cat up the tree.', SEED);
  const lower = out.toLowerCase();
  const noComma = !out.includes(',');
  const order = lower.indexOf('dog') >= 0 && lower.indexOf('dog') < lower.indexOf('the cat');
  if (noComma && order) ok(`PP inside object left alone: ${JSON.stringify(out)}`);
  else no(`PP inside object mangled: ${JSON.stringify(out)}`);
}

// "lost" must survive as an adjective: the old verb rule said "was vanquished".
{
  const out = yoda.transform('I want to find the lost treasure.', SEED);
  if (!out.includes('was vanquished') && out.includes('lost')) {
    ok(`no "was vanquished" garbling: ${JSON.stringify(out)}`);
  } else {
    no(`word table garbled "lost": ${JSON.stringify(out)}`);
  }
}

// Infinitive fronting takes pronoun subjects only.
{
  const out = yoda.transform('The dog wants to chase the cat.', SEED);
  if (!out.includes(',')) ok(`non-pronoun subject not fronted: ${JSON.stringify(out)}`);
  else no(`fronted a non-pronoun subject: ${JSON.stringify(out)}`);
}

// The rule accepts up to five words after "to"; longer phrases stay put.
{
  const out = yoda.transform('I want to find the really big treasure today', SEED);
  if (!/^To /.test(out)) ok(`long infinitive phrase left in order: ${JSON.stringify(out)}`);
  else no(`fronted a >5-word infinitive: ${JSON.stringify(out)}`);
}

// --- long inputs: words are reordered, never dropped or doubled --------------

console.log('\nlong inputs (seed 42)');

// Chosen to hit no word-table key, so the only legal changes are structural
// reordering plus additive flourishes (openings, asides). The precondition
// below proves the table really leaves them alone.
const LONG = [
  'the brave knight rode swiftly into the dark forest before the morning star appeared',
  'will you help me find the secret treasure in the stone ruins tonight?',
  'she said that he was coming and they would linger by the river until morning',
];

// Function words: shared with insertions, so their counts may legitimately
// rise. Content words must all survive.
const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'by', 'from', 'into', 'before', 'until', 'that', 'he', 'she', 'they',
  'we', 'you', 'i', 'it', 'is', 'was', 'were', 'would', 'will', 'me', 'my',
]);

function words(text) {
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

for (const input of LONG) {
  const core = yoda.api.replaceAll(input);
  if (core.toLowerCase() !== input.toLowerCase()) {
    no(`test input ${JSON.stringify(input)} hits the word table (${JSON.stringify(core)}); pick a cleaner one`);
    continue;
  }
  const out = yoda.transform(input, SEED);
  const outWords = words(out);
  const problems = [];
  if (!out.trim()) problems.push('empty output');
  if (/\b(\w+) \1\b/i.test(out)) problems.push('doubled word');
  if (/[a-z],[a-z]/.test(out)) problems.push('fused comma');
  const counts = new Map();
  for (const w of outWords) counts.set(w, (counts.get(w) || 0) + 1);
  for (const w of words(input)) {
    if (STOP.has(w)) continue;
    if (!counts.has(w)) { problems.push(`dropped ${JSON.stringify(w)}`); break; }
    counts.set(w, counts.get(w) - 1);
  }
  if (problems.length) {
    no(`${JSON.stringify(input)}: ${problems.join('; ')}\n        got ${JSON.stringify(out)}`);
  } else {
    ok(`${JSON.stringify(input.slice(0, 48))}... intact (${outWords.length} words)`);
  }
}

console.log(failures ? `\n${failures} yoda check(s) failed` : '\nevery yoda check passed');
process.exitCode = failures ? 1 : 0;
