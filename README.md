# Text Repriser Collection

A collection of single-page web apps that rewrite modern English into six
literary and historical styles — plus a reverse dictionary that converts
stylized text back to modern English. Everything runs client-side in the
browser. Each page is fully self-contained (bundled word data, CSS, and
JavaScript) with zero dependencies.

![Shakespeare Text Repriser](./Screenshot.png)

## Live Demo

Hosted with GitHub Pages: **[Live site](https://cuber7649.github.io/shakespeare-repriser/)**

| Style | Link |
| ----- | ---- |
| Shakespeare | [Open](https://cuber7649.github.io/shakespeare-repriser/shakespeare.html) |
| Pirate | [Open](https://cuber7649.github.io/shakespeare-repriser/pirate.html) |
| Victorian | [Open](https://cuber7649.github.io/shakespeare-repriser/victorian.html) |
| Chaucer | [Open](https://cuber7649.github.io/shakespeare-repriser/chaucer.html) |
| Yoda | [Open](https://cuber7649.github.io/shakespeare-repriser/yoda.html) |
| Norse | [Open](https://cuber7649.github.io/shakespeare-repriser/norse.html) |
| Unscramble | [Open](https://cuber7649.github.io/shakespeare-repriser/unscramble.html) |

## Styles

| Page | Style | Example |
| ---- | ----- | ------- |
| `shakespeare.html` | Elizabethan English | "how are you" → "how dost thou fare" |
| `pirate.html` | Golden Age of Piracy | "you are my friend" → "ye be my matey" |
| `victorian.html` | Victorian English | "really" → "truly"; "you are" → "one is" |
| `chaucer.html` | Middle English | "you are happy" → "thou art blisful" |
| `yoda.html` | Jedi Master speech | Object–subject–verb inversions |
| `norse.html` | Vikings and Norse myth | "you are happy" → "ye are merry" |
| `unscramble.html` | Reverse dictionary | "thou art" → "you are" (800+ entries) |

## Features

- **Themed word replacement** — hundreds of verbs, adjectives, nouns, and phrases per style
- **Sentence-level transforms** — e.g. "I want to" becomes "my heart hungereth to" (Norse) or "I be yearning to" (Pirate)
- **Contraction handling** — e.g. "don't" becomes "thou dost nat" (Chaucer) or "ye do not" (Norse)
- **Random quotations** — Shakespeare, Austen, the Hávamál, pirate sayings, and Jedi wisdom
- **Themed insults** — e.g. "ye scurvy dog", "thou cherl", "you insufferable bounder"
- **Dramatic asides and stage directions** — e.g. "[The longship sets sail.]"
- **Metaphors and similes** — e.g. "as fierce as a berserker", "as wild as the open sea"
- **Sentence inversion** — reordered syntax for emphasis
- **Style-switcher navigation** — move between styles from any page
- **Keyboard shortcut** — press Ctrl+Enter to transform
- **Copy to clipboard** — supported on local files and HTTPS
- **Unscrambler** — removes openings, asides, and stage directions, then reverses 800+ dictionary entries, including multi-word phrases
- **Responsive layout** — verified from mobile to desktop viewports
- **Family-friendly content** — all word lists audited; no profanity, slurs, or explicit material

## Getting Started

No build step or installation is required.

1. Open any page in a modern browser (start with `shakespeare.html`, or use the live demo above).
2. Enter modern English text in the input field.
3. Click the transform button, or press **Ctrl+Enter**.
4. Copy the result with the **Copy to Clipboard** button.
5. To reverse stylized text, paste it into `unscramble.html` and click **Unscramble!**

## Examples

| Input | Style | Output |
| ----- | ----- | ------ |
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

> Note: output varies between runs due to randomized openings, inversions, metaphors, and quotations.

## Project Structure

```text
shakespeare-repriser/
├── shakespeare.html   # Elizabethan style (original page)
├── pirate.html        # Pirate style
├── victorian.html     # Victorian style
├── chaucer.html       # Middle English style
├── yoda.html          # Yoda speech style
├── norse.html         # Norse style
├── unscramble.html    # Reverse dictionary
├── README.md
└── Screenshot.png
```

Each `.html` file is a standalone app: open it directly in a browser or serve the directory with any static file server. There are no shared runtime files.

## Browser Support

Works in all modern browsers (Chrome, Edge, Firefox, Safari), on desktop and mobile.
An internet connection is only needed for the Google Fonts stylesheets; the apps
fall back to system serif fonts when offline.

## License

Do what thou wilt.
