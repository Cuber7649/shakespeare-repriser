// Inputs chosen to exercise every stage of the engine: each dictionary,
// the inversion path, the comma-dependent inserts, and multi-sentence input.

export const CORPUS = [
  // README examples
  'hello how are you today',
  'I am so happy to see my friend',
  'we will travel tomorrow and find the treasure',
  'you are brave',

  // pronouns / verb forms
  'you are my friend',
  'he was happy',
  'she is coming',
  'they have gone',
  'we are ready',
  'I am happy',
  'your house is big',
  'ours is small',
  'yourself must know',
  'yourselves must know',

  // contractions
  "don't you think it's great?",
  "I'm going to leave",
  "you'll be sorry",
  "we've won",
  "he's arrived",
  "she'd rather stay",
  "there's nothing here",
  "that's the way",
  "gonna wanna kinda sorta",
  "tryna leave",

  // negatives
  "I can't go",
  "she won't come",
  "they aren't ready",
  "we haven't finished",
  "you shouldn't worry",
  "let's go",
  "it isn't here",

  // multi-word sentence transforms
  'what do you think about this?',
  'how do you do',
  'good morning my lord',
  'good night sweet prince',
  'nice to meet you',
  'see you later',
  'my name is Hamlet',
  'excuse me may I pass',
  'how is it going',
  "don't you dare",
  'can you help me',
  'would you like some tea',
  'you have no idea',
  'you do not know',
  'shut up',
  'my bad',
  'sorry about that',
  'thank you very much',
  'thanks a lot',
  'yes I agree',
  'no way',
  'ok fine',
  'sure thing',
  'hello there',
  'hi friend',
  'goodbye my friend',
  'bye',
  'okay then',
  'yup',
  'nope',

  // commonWords
  'maybe we should really leave before tomorrow',
  'it is very good but actually quite bad',
  'however I think you are wrong about everything',
  'enough is enough',
  'between now and then',
  'because of the rain',
  'somewhere in the darkness',
  'very probably not at all',
  'I have been there recently',
  'they are almost certainly right',

  // verbs / adjectives / nouns
  'the angry dog ran quickly across the field',
  'she will jump over the broken wall',
  'he whispered a terrible secret',
  'we climbed the ancient tower',
  'they swam across the cold river',
  'the happy child laughed',
  'a strange noise came from the house',
  'I love the bright sun',
  'the brave soldier fought',
  'we talked about the future',

  // simple SVO statements for frontObject (object fronting)
  'I like pie',
  'the dog chased the cat',
  'my sister baked fresh bread',

  // inversion triggers
  'I am not afraid',
  'he is going home',
  'she was very tired',
  'we were having fun',
  'they are waiting now',
  'I have seen it',
  'he will understand',
  'we should leave',
  'they could arrive',

  // multi-sentence and punctuation
  'You are late. I am angry. Where are you going?',
  'Hello! How are you? Fine, thanks.',
  'One, two, three. Four, five, six.',
  'Wait... what did you say?',
  'A comma, to trigger the metaphor insert, in the middle.',

  // Words that used to match inside longer words when a rule was missing its
  // leading \b (yoda had 22 such rules).
  'grandchild notebook animate lifebook swordfish',
  'a child with a sword',
  'my mate read a book',
  'grandchildren and babies',

  // Inputs that stress the quote-card renderer: literal brackets and
  // parentheses, a one-word input, and a paragraph long enough to truncate.
  'the sign said [beware] ahead of the bridge',
  'the price (very high) is far too steep',
  'hello',
  'a b c',
  'the quick brown fox jumps over the lazy dog while the morning sun rises slowly over the quiet village and the distant mountains echo with the sound of many travellers passing by on their way to the market where merchants sell their bright coloured goods to anyone with coin enough to pay',

  // edge cases
  '',
  '   ',
  'a',
  'the',
  'I',
  'you',
  'no punctuation at all just a very long run of words that keeps going and going',
  'ALL CAPS SHOUTING TEXT HERE',
  'multiple   spaces   between   words',
  "it's a test with 0 numbers and $pecial ch@racters!",
  'emoji test 🎲🚀 here',
  'trailing whitespace   ',
];

export const SEEDS = [1, 2, 3, 7, 42, 1337];
