// SURPRISE ME: curated sample sentences + one-click transform.
// "Surprise Me!": fill the input with a curated family-friendly sample
// sentence and immediately run the transformation.
//
// Sample selection is kept separate from the transformation engine: this
// block only picks a sentence and hands it to the page's own transform
// function. Randomness goes through the page's seeded rand(), never
// Math.random(), so behaviour stays deterministic for a given seed.
//
// Pasted verbatim into every style page by tools/paste-shared.mjs and
// inlined into the dashboard by tools/build-dashboard.mjs.

const SURPRISE_SENTENCES = [
  "hello how are you today",
  "I am so happy to see my friend",
  "we will travel tomorrow and find the treasure",
  "you are brave",
  "I like pie",
  "he whispered a terrible secret",
  "the old king ruled the land",
  "how are you",
  "good morning my lord",
  "thank you very much",
  "nice to meet you",
  "see you later",
  "don't you think it's great?",
  "I'm going to leave",
  "the angry dog ran quickly across the field",
  "she will jump over the broken wall",
  "the sun shines bright today",
  "a kind word goes a long way",
  "the cat sat on the mat",
  "we had a wonderful time",
  "it is a fine day",
  "the bird sang a sweet song",
  "she reads a good book",
  "he walks through the park",
  "they shared a lovely meal",
  "the flowers bloom in spring",
  "a cold drink on a hot day",
  "the rain falls on the roof",
  "we play in the garden",
  "he tells a funny joke",
  "she writes a letter home",
  "the stars shine at night",
  "all the world's a stage",
  "to be or not to be",
  "parting is such sweet sorrow",
  "something wicked this way comes",
  "all that glitters is not gold",
  "brevity is the soul of wit",
  "though she be but little she is fierce",
  "friends romans countrymen lend me your ears",
  "we few we happy few we band of brothers",
  "it was the best of times",
  "call me ishmael",
  "it is a truth universally acknowledged",
  "i have a dream",
  "ask not what your country can do for you",
];

// Last chosen index, so the same sentence is never picked twice in a row
// when the pool has more than one entry.
let surpriseLastIndex = -1;

function surprisePick() {
  const n = SURPRISE_SENTENCES.length;
  if (n === 0) return '';
  if (n === 1) {
    surpriseLastIndex = 0;
    return SURPRISE_SENTENCES[0];
  }
  let idx;
  do {
    idx = Math.floor(rand() * n);
  } while (idx === surpriseLastIndex);
  surpriseLastIndex = idx;
  return SURPRISE_SENTENCES[idx];
}

// Put a random sample sentence into the input, refresh the character count,
// and run the page's own transformation. `transformFn` is the page's main
// transform (shakespearify, pirateify, ...) or transformAll on the dashboard.
function surpriseApply(inputEl, charCountEl, transformFn) {
  if (!inputEl || typeof transformFn !== 'function') return;
  const sentence = surprisePick();
  if (!sentence) return;
  inputEl.value = sentence;
  if (charCountEl) charCountEl.textContent = String(sentence.length);
  transformFn();
}
