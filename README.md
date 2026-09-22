# Text Repriser Collection

Transform modern English into six literary and historical styles — or reverse
stylized text back to modern English — right in the browser. Each page is fully
self-contained (its own word data, CSS, and JS) with zero dependencies.

## View it online

Live site: **https://cuber7649.github.io/shakespeare-repriser/**

| Page | Link |
| ---- | ---- |
| Shakespeare | https://cuber7649.github.io/shakespeare-repriser/shakespeare.html |
| Pirate | https://cuber7649.github.io/shakespeare-repriser/pirate.html |
| Victorian | https://cuber7649.github.io/shakespeare-repriser/victorian.html |
| Chaucer | https://cuber7649.github.io/shakespeare-repriser/chaucer.html |
| Yoda | https://cuber7649.github.io/shakespeare-repriser/yoda.html |
| Norse | https://cuber7649.github.io/shakespeare-repriser/norse.html |
| Unscramble | https://cuber7649.github.io/shakespeare-repriser/unscramble.html |

![Shakespeare Text Repriser](./Screenshot.png)

## Pages

| Page | Theme | What it does |
| ---- | ----- | ------------ |
| `shakespeare.html` | Elizabethan England | "how are you" → "how dost thou fare" |
| `pirate.html` | Golden Age of Piracy | "you are my friend" → "ye be my matey" |
| `victorian.html` | Victorian England | "really" → "truly", "you are" → "one is" |
| `chaucer.html` | Middle English | "you are happy" → "thou art blisful" |
| `yoda.html` | Jedi Master speech | Object-subject-verb inversions |
| `norse.html` | Vikings & Norse myth | "you are happy" → "ye are merry" |
| `unscramble.html` | Reverse dictionary | "thou art" → "you are", 800+ entries |

## Features

- **Hundreds of word replacements per page** — verbs, adjectives, nouns, and more, themed per style
- **Sentence-level transforms** — "I want to" → "my heart hungereth to" (Norse), "I be yearning to" (Pirate)
- **Contraction handling** — "don't" → "thou dost nat" (Chaucer), "ye do not" (Norse)
- **Random quotes** — Shakespeare, Austen, Hávamál, pirate sayings, Jedi wisdom
- **Themed insults** — "ye scurvy dog", "thou cherl", "you insufferable bounder" (family-friendly)
- **Dramatic asides & stage directions** — "[The longship sets sail.]", "(aside: Hmm, much to learn, you still have.)"
- **Metaphors & similes** — "as fierce as a berserker", "as wild as the open sea"
- **Sentence inversion** — flips word order for emphasis
- **Style-switcher navigation** — hop between styles from any page
- **Ctrl+Enter hotkey** — transform without touching the mouse
- **Copy to clipboard** — works on both local files and HTTPS
- **Unscrambler** — strips openings, asides, and stage directions, then reverses 800+ dictionary entries (including multi-word phrases)

## Usage

1. Open any page in a modern browser (start with `shakespeare.html`)
2. Type modern English into the input box
3. Click the transform button (or press **Ctrl+Enter**)
4. Copy the output
5. To reverse stylized text, paste it into `unscramble.html` and click **Unscramble!**

## Examples

| Input | Page | Output |
| ----- | ---- | ------ |
| `hello how are you today` | Shakespeare | Hail how dost thou fare this day |
| `hello how are you today` | Pirate | Ahoy how be ye today |
| `hello how are you today` | Chaucer | Hail how fareth thou today |
| `hello how are you today` | Norse | Hail how fare ye this day |
| `I am so happy to see my friend` | Pirate | I be so jolly to spy my matey |
| `I am so happy to see my friend` | Chaucer | I am so blisful to seigh my freend |
| `we will travel tomorrow and find the treasure` | Victorian | We will journey the morrow and come upon the treasure |
| `we will travel tomorrow and find the treasure` | Norse | We will journey the morrow and come upon the treasure |
| `you are brave` | Yoda | Are you brave |
| `thou art happy` | Unscramble | you are happy |

> **Note:** Output varies each run thanks to random openings, inversions, metaphors, and quotes. All content is family-friendly.

## License

Do what thou wilt.
