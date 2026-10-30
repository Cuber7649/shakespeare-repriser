# Development

Everything is plain HTML, CSS and JavaScript. There is no framework, no bundler
and no `npm install`: the scripts in `tools/` use Node built-ins only. Open a
style page directly from disk and it works.

## First run

```bash
node --version        # 18+; the suite is developed on 24
npm test              # 27 steps, about 10 seconds
```

`npm test` runs `tools/run-all.mjs`, which lists the steps in order. A green run
ends with `working tree is ready to push`.

## The shape of the repository

| Path | What it is |
| ---- | ---------- |
| `shakespeare.html`, `pirate.html`, `victorian.html`, `chaucer.html`, `yoda.html`, `norse.html` | Six standalone apps. Each owns its dictionaries, engine and UI. |
| `index.html` | Dashboard, generated from the six pages. Never edit by hand. |
| `tools/` | Shared source blocks, generators and tests. |
| `tools/options.{js,css,html}`, `savedquotes.*`, `compare.*`, `cardui.js`, `cardpage.js`, `quotecard.js`, `surprise.js`, `card-modal.*` | Shared UI logic, pasted verbatim into all pages. |
| `tools/paste-shared.mjs` | Pastes those blocks into the six style pages. |
| `tools/build-dashboard.mjs` | Copies each page's engine into `index.html`. |

## The edit loop

1. Edit the source: a style page for vocabulary, or `tools/` for shared logic.
2. If a shared block changed, run `node tools/paste-shared.mjs`.
3. Rebuild the dashboard: `node tools/build-dashboard.mjs` (or `npm run build`).
4. Run `npm test`.

Never edit a pasted copy inside a page, and never edit `index.html`,
`manifest.json` or the icons. `paste-shared.mjs --check`, `verify-dashboard.mjs`
and `test-reproducible.mjs` fail the suite when generated output drifts.

## The transformation pipeline

Each paragraph is split into sentences. For every sentence:

1. **`replaceAll()`** — one left-to-right pass over the dictionaries,
   longest match wins. Replacement text is never rescanned.
2. **`fixPronounCase()`** — flips subject `thou` to object `thee` after a
   preposition or transitive verb. Only Shakespeare and Chaucer define a
   `pronounCase` config; the other styles set it to `null`.
3. **`fixAgreement()`** — repairs subject-sensitive verb forms the flat tables
   cannot see (`I doth` → `I do`, `he wast` → `he was`). Shakespeare and Chaucer
   define rules; the rest use `null`.
4. **The insertion budget** — at most one decorative insertion per sentence.
   In order, each helper checks `budget.used`:
   inversion (if enabled), filler, metaphor, alliteration, parenthetical,
   insult, opening exclamation, mid-sentence insertion.
5. **`dedupeIntensity()`** — collapses `exceedingly most` and similar.
6. **`join()`** — sentences are rejoined with spaces.

After all paragraphs are transformed, the page may insert a quotation, an
aside and a stage direction (gated by settings), then runs whitespace,
duplicate-word and capitalisation cleanups.

### Settings

| Control | Values | Effect |
| ------- | ------ | ------ |
| Intensity | Light / Balanced / Dramatic | Light skips filler, parentheticals, insults, openings, mid-insertions and quotations, and halves the remaining chances. Dramatic raises the chance scale to 1.5. |
| Opening phrases | on/off | Opening exclamation before a sentence. |
| Metaphors and similes | on/off | Metaphor and alliteration insertions. |
| Stage directions and asides | on/off | Quotation, aside and stage-direction insertions after paragraphs. |
| Sentence inversion | on/off | Main-clause inversion only. |

Defaults are balanced with every toggle on, and reproduce the pre-settings
engine exactly. `tools/test-settings.mjs` locks that.

### Seeding

Randomness goes through a seeded mulberry32 (`seedRandom`/`rand`/`pick`/
`chance`), never `Math.random()`. The page starts at seed 0 and advances on
every click; the optional **Seed** field makes a run reproducible. The dashboard
derives a seed per run unless the field is filled. `seedRandom(0)` maps to the
default constant, so use a non-zero seed when you need an exact replay.

## Adding a style

A style is a self-contained page plus entries in the generators and tests. Copy
an existing page as the starting point; the engine, helpers and shared blocks
are already in it.

1. **Create the page.** Copy e.g. `pirate.html` to `mystyle.html`, rename the
   main function (`pirateify` → `mystyleify`), change the title, header copy,
   footer and `data-save` labels. Keep the shared blocks byte-identical.
2. **Replace the dictionaries.** Change the tables and decorative pools. Keep
   the table names and order so `build-dashboard.mjs` can extract them.
3. **Register the style** in:
   - `tools/build-dashboard.mjs` (`STYLES`: id, label, href, entry, icon)
   - `tools/paste-shared.mjs` (`PAGES`)
   - `tools/check-readme.mjs`, `tools/readme-examples.mjs`,
     `tools/readme-features.mjs`
   - `tools/test-content.mjs`, `tools/test-grammar.mjs`,
     `tools/test-settings.mjs`, `tools/test-links.mjs`,
     `tools/test-cardpages.mjs`, `tools/test-savedquotes.mjs`,
     `tools/test-compare.mjs`
   - `tools/check-a11y.mjs`, `tools/prepush-check.mjs`,
     `tools/test-manifest.mjs`, `tools/test-reproducible.mjs`
   - `tools/browser-journeys.mjs` (the real-browser journey)
   - `tools/snapshot.mjs` and `tools/corpus.mjs` if you want seed coverage
   - the style switcher in all seven pages
4. **Add README rows.** The Styles table and the Examples table are checked
   against real output; `check-readme.mjs` will tell you when they disagree.
5. **Run the suite.** `npm test` names every file that still does not know about
   the new style.

This is deliberately repetitive: zero shared runtime files is the design
constraint. `grep -ril "norse" tools/` is the quickest way to find every
registry.

## Edge-case contract

These are enforced by `tools/test-edgecases.mjs`:

| Input | Expected |
| ----- | -------- |
| empty or whitespace only | a short prompt, never a crash or empty output |
| punctuation only | survives cleanup; output is still a string |
| numbers | preserved |
| emoji | preserved (input is user text; the ban is on authored UI copy) |
| RTL text | preserved |
| `<b>hello</b>` | treated as literal text, tags kept as characters |
| `[aside] hello` | bracket text kept as characters |
| blank-line paragraphs | blank-line separation survives |
| ~10,000 characters | completes under 5 s and does not lose most of the text |
| ~5,000 words | completes under 5 s |
| one 5,000-character word | completes under 2 s |

## Running one test

```bash
node tools/test-grammar.mjs
node tools/test-settings.mjs
node tools/test-content.mjs
node tools/verify-dashboard.mjs
```

Each script exits non-zero on failure and prints what it checked. To exercise
the engine directly with a seed:

```js
import { loadPage } from './tools/harness.mjs';
const page = loadPage('./shakespeare.html', 'shakespearify');
console.log(page.transform('hello how are you today', 42));
```

## Changing the engine

The engine block is duplicated in all six pages by design; the dashboard
extracts it verbatim. Change every page (a small script is less error-prone than
six hand edits), then run `paste-shared.mjs` and the suite. Review word-list
changes with a snapshot diff:

```bash
node tools/snapshot.mjs before.json
# edit
node tools/snapshot.mjs after.json
node tools/compare.mjs before.json after.json
```

`pick()` is index-based, so removing or reordering an entry shifts every seeded
output downstream. Judge the blast radius by whether it is proportionate to the
edit, not by whether anything moved.

## Traps

- **Line endings.** Generated `index.html` and `manifest.json` are LF. Style
  pages have some CRLF from pasted blocks; when splicing, be byte-precise.
- **Windows.** `&` splits commands in `cmd.exe`; `node -e` with nested quotes
  can fail silently — write a temporary `.mjs` file instead. Heredocs do not
  work; use `git commit -F <file>`.
- **Unseeded randomness** voids the regression suite. Use `rand()`/`pick()`.
- **Emoji in UI text** must be HTML entities, not literal characters.
- **Content policy.** New quotes and roasts must pass
  [`CONTENT_POLICY.md`](./CONTENT_POLICY.md).
