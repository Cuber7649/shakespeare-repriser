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
  ['You need to leave the old temple.', 'To leave the ancient temple, you need.'],
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
  ['I think you will like it.', 'You will like it, I think.'],
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
  ['I am very happy to see you.', 'Very glad to see you, I am.'],
  ['I have to go.', 'I must go.'],
  ["I shouldn't go.", 'Go, I should not.'],
  ["You can't escape.", 'You cannot escape.'],
  ['There is no try.', 'No try, there is.'],
  ['There are no ghosts.', 'No ghosts, there are.'],
  ['Do or do not. There is no try.', 'Do or do not. No try, there is.'],

  // Transitive or phrasal uses the flat word table used to garble. The safe
  // choice is to keep the plain verb rather than emit "ceased the car",
  // "triumphed the race", "Depart him alone" or "Place away your weapon".
  ['They won the battle.', 'The battle, they won.'],
  ['She won the race.', 'The race, she won.'],
  ['He won.', 'He triumphed.'],
  ['The Jedi won the war.', 'The war, the Jedi won.'],
  ['I stopped the car.', 'The car, I stopped.'],
  ['The rain stopped.', 'The rain stopped.'],
  ['They stopped the attack.', 'The strike, they stopped.'],
  ['She started the car.', 'The car, she started.'],
  ['The meeting started.', 'The meeting began.'],
  ['She started the meeting.', 'The meeting, she started.'],
  ['Leave me alone.', 'Leave me alone.'],
  ['Leave it.', 'Leave it.'],
  ['I leave the room.', 'The room, I leave.'],
  ['I leave tomorrow.', 'I depart tomorrow.'],
  ['Answer me.', 'Answer me.'],
  ['She answered the question.', 'The question, she answered.'],
  ['She answered.', 'She replied.'],
  ['Say it.', 'Say it.'],
  ['I say so.', 'I say so.'],
  ['I say.', 'I speak.'],
  ['What did he say?', 'What did he say?'],
  ['I think so.', 'I think so.'],
  ['I think about you.', 'I think about you.'],
  ['I run the ship.', 'The ship, I run.'],
  ['I run.', 'I rush.'],
  ['I feel sad.', 'Sorrowful, I feel.'],
  ['I feel like leaving.', 'I feel like leaving.'],
  ['He feels cold.', 'Cold, he feels.'],
  ['I feel the Force.', 'The Force, I sense.'],
  ['It smells bad.', 'Bad, it smells.'],
  ['She sings and dances.', 'She sings and dances.'],
  ['He ran and jumped.', 'He ran and leapt.'],
  ['She put away the book.', 'She put away the tome.'],
  ['I put the book away.', 'I put the tome away.'],
  ['He put down the weapon.', 'He put down the weapon.'],
  ['Put away your weapon.', 'Put away your weapon.'],
  ['Put on your helmet.', 'Don your helmet.'],
  ['She put on a brave face.', 'She put on a brave face.'],
  ['They put together the droid.', 'They put together the droid.'],
  ['I searched for the droid.', 'The droid, I sought.'],
  ['It is hard to say.', 'Hard to tell, it is.'],
  ['He is bad at math.', 'Poor at math, he is.'],
  ['The weather is bad.', 'Foul, the weather is.'],
  ['She is on the run.', 'She is on the run.'],
  ['See you tomorrow.', 'See you tomorrow.'],
  ['I see you.', 'You, I see.'],
  ['He is happy that she came.', 'Glad that she came, he is.'],
  ['She is sad.', 'Sorrowful, she is.'],

  // Complex objects: a short bare infinitive is not a noun to front.
  ['I saw the ship land.', 'I saw the ship land.'],
  ['I saw the ship crash.', 'I saw the ship crash.'],
  ['I heard the droid beep.', 'I heard the droid beep.'],

  // Imperative causatives are not subject + verb.
  ['Make the droid carry the box.', 'Make the droid carry the box.'],
  ['Let the droid carry the box.', 'Let the droid carry the box.'],

  // Common question idioms: "what think you" / "what mean you" are archaic
  // but grammatical. The old "think, what do you" reordered the verb into
  // the wh-word's slot and read as a fragment.
  ['What do you think?', 'What think you?'],
  ['What do you mean?', 'What mean you?'],
  ['What do you mean by that?', 'What mean you by that?'],
  ['What do you think about it?', 'What think you of it?'],
  ['What do you think of the plan?', 'What think you of the plan?'],

  // "think" stays as "think". "consider" cannot take a bare clause
  // ("I consider we should go"), and "believe again" is not "think again".
  ['I think we should go to the market today.',
    'I think we should go to the market today.'],
  ['I think we should go.', 'We should go, I think.'],
  ['I think better of it.', 'I think better of it.'],
  ['Think again.', 'Think again.'],
  ['Great minds think alike.', 'Great minds think alike.'],

  // Existing structural limits still hold.
  ['I want to find the really big treasure today',
    'I want to find the truly great treasure today'],
  ['The dog wants to chase the cat.', 'The dog wants to pursue the cat.'],
  ['The dog chased the cat up the tree.', 'The dog pursued the cat up the tree.'],

  // Intransitives, ditransitives and complex objects must not be reversed
  // ("Smiled, Luke Skywalker.", "Him go, I made.").
  ['Luke Skywalker smiled.', 'Luke Skywalker smiled.'],
  ['The Sith Lord fell.', 'The Sith Lord fell.'],
  ['The Clone Wars began.', 'The Clone Wars began.'],
  ['The droid army advanced.', 'The droid army advanced.'],
  ['She told me a story.', 'She told me a story.'],
  ['I gave him the book.', 'I gave him the tome.'],
  ['I made him go.', 'I made him go.'],
  ['She found the droid broken.', 'She found the droid shattered.'],
  ['He painted the door red.', 'He painted the door red.'],
  ['I attended the meeting.', 'The meeting, I attended.'],
  ['The farmer planted the seed.', 'The seed, the farmer planted.'],
  ['I set the table.', 'The table, I set.'],
  ['I heard the song.', 'The song, I heard.'],

  // Negative questions put the auxiliary first; negative statements keep
  // their order.
  ["Isn't it a trap?", 'Is it not a trap?'],
  ["Don't you know?", 'Do you not comprehend?'],
  ['Why isn\u2019t it working?', 'Why is it not working?'],
  ["You like it, aren't you?", 'You like it, are you not?'],
  ['I am not you.', 'I am not you.'],

  // "'s" is "has" and "'d" is "had" before a participle; elsewhere the table
  // keeps "is"/"would".
  ["It's been a long day.", 'It has been a long day.'],
  ["I'd been waiting for hours.", 'I had been waiting for hours.'],
  ["They'd already left.", 'They had already left.'],
  ["You'd better go.", 'You had better go.'],
  ["He's gone.", 'He is gone.'],
  ["I'd like to go.", 'I would like to go.'],

  // Tense the word table cannot see on its own.
  ['I put the book there.', 'I placed the tome there.'],
  ['She put on her cloak.', 'She donned her cloak.'],
  ['I kept walking.', 'I kept walking.'],
  ['I left the book.', 'The tome, I left.'],
  ['The battle has been won.', 'The battle has been won.'],

  // Splitting: abbreviations, decimals, ellipses, quoted ends and initialisms.
  ['Dr. Jones knows the truth.', 'Dr. Jones comprehends the truth.'],
  ['The ship costs 3.5 credits.', 'The ship costs 3.5 credits.'],
  ['Well...', 'Well...'],
  ['The party starts at 5 p.m. tonight.', 'The party starts at 5 p.m. tonight.'],
  ['He said "Go." Then left.', 'He said "Go." Then left.'],
  ['The U.S. is strong.', 'The U.S. is powerful.'],

  // Titles the adjective table used to recase or rewrite.
  ['Old Ben is wise.', 'Wise, Old Ben is.'],
  ['The Old Republic fell.', 'The Old Republic fell.'],
  ['A New Hope.', 'A New Hope.'],

  // Idioms.
  ['What do you think about it?', 'What think you of it?'],
  ['Do I have to go?', 'Must I go?'],
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

// --- punctuation and flourish invariants (defaults on) -----------------------

console.log('\npunctuation and flourish invariants (seeds 1-60)');

// Inserted flourishes must not stack punctuation ("fought., clouded by fear,
// you are!"), double up "like as calm as ...", or crush an ellipsis to "..".
// Questions must never keep the raw contraction order "is not it".
{
  const INPUTS = [
    'The brave young Jedi fought the dark lord.',
    'I like pie.',
    'The sky is blue.',
    'Well...',
  ];
  const QUESTIONS = [
    "Isn't it a trap?",
    "Don't you know?",
    'Why isn\u2019t it working?',
    "Aren't you ready?",
  ];
  const problems = [];
  for (let seed = 1; seed <= 60; seed++) {
    for (const input of INPUTS) {
      const out = yoda.transform(input, seed);
      if (out.includes('.,')) problems.push(`stray ".," (seed ${seed}): ${out}`);
      if (out.includes('!,') || out.includes('?,')) problems.push(`stray ", after !?" (seed ${seed}): ${out}`);
      if (out.includes('like as')) problems.push(`"like as" (seed ${seed}): ${out}`);
      if (/[a-z],[a-z]/.test(out)) problems.push(`fused comma (seed ${seed}): ${out}`);
      const runs = out.match(/\.+/g) || [];
      if (runs.some((r) => r.length === 2)) problems.push(`double period (seed ${seed}): ${out}`);
    }
    for (const input of QUESTIONS) {
      const out = yoda.transform(input, seed);
      if (/\bnot (i|you|we|they|he|she|it)\b/i.test(out)) {
        problems.push(`"not <subject>" order (seed ${seed}): ${out}`);
      }
    }
    const won = yoda.transform('The battle has been won.', seed);
    if (/been triumphed/.test(won)) problems.push(`passive "been triumphed" (seed ${seed}): ${won}`);
  }
  if (problems.length) {
    no(`${problems.length} punctuation/flourish problem(s)`);
    for (const p of problems.slice(0, 8)) console.log(`        ${p}`);
  } else {
    ok('no stray punctuation, "like as", double periods, or raw negative questions');
  }
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
