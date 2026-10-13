# shakespeare-repriser — build and test tooling

Everything that generates or verifies the site. Zero dependencies: plain Node with
`node:fs` / `node:vm` / `node:child_process`. Nothing here ships to the browser.

## Commands

```bash
npm run build   # regenerate index.html from the six style pages
npm test        # run the whole suite (build + 18 checks, ~90s)
```

`npm install` is never needed — there are no dependencies. Any individual script
also runs directly, e.g. `node tools/verify-dashboard.mjs`.

## What is here

| Script | Purpose |
| ------ | ------- |
| `build-dashboard.mjs` | Regenerate `index.html` from the style pages |
| `build-icons.mjs` | Regenerates the app icons and `manifest.json` |
| `build-screenshot.mjs` | **Opt-in**: retake `Screenshot.png` via headless Edge. Never part of the suite — it overwrites a hand-maintained file |
| `run-all.mjs` | Runs every step below in order; any non-zero exit fails |
| `verify-dashboard.mjs` | Asserts the dashboard's output matches every style page |
| `smoke-dashboard.mjs` | Loads `index.html` in a sandbox, exercises the UI, checks the quote card against a fake 2D context (runs at dpr 1, 2 and 3) |
| `test-quotecard.mjs` | Strip patterns, layout maths, font shrinking, truncation warnings |
| `test-cardpages.mjs` | The Make Card button, modal markup and `cardpage.js` wiring pasted identically into all 7 pages; opens with the output text, message when empty |
| `test-savedquotes.mjs` | The saved-quotes block pasted byte-identically into all 7 pages; save, delete, cap and corruption behaviour |
| `test-engine.mjs` | Compares the single-pass engine against the old chain |
| `test-content.mjs` | Family-friendly word lists, no servitude roasts, no duplicates |
| `test-yoda.mjs` | Object fronting, infinitive fronting, the strict object guard, seeded seed-42 outputs |
| `test-manifest.mjs` | Installability criteria, declared icon sizes vs real PNG bytes, launcher shortcuts (optional) |
| `test-reproducible.mjs` | Generated output is pure LF and rebuilds byte-identically |
| `test-links.mjs` | Every local href resolves; all pages share one switcher |
| `check-css.mjs` | Brace balance, one `prefers-reduced-motion` block per file, real `<label for>` wiring |
| `check-readme.mjs` | Every README example matches real output across the corpus seeds |
| `readme-features.mjs` | Every README claim is supported by the code |
| `readme-examples.mjs` | Prints real output for every README example across several seeds |
| `harness.mjs` | Loads a page's inline `<script>` in Node with a stubbed DOM |
| `page-source.mjs` | Source-extraction helpers shared by the generators |
| `quotecard.js` | Quote card: strip, layout, draw, export. Inlined into `index.html` by the generator and loaded directly by the tests, so both run identical source |
| `cardui.js` | Quote-card preview modal wiring, shared by the generator and the smoke test |
| `cardpage.js` | Binds a style page's Make Card button to the modal; inlined into all six style pages |
| `card-modal.html` / `card-modal.css` | The modal's markup and styles, inlined by the generator |
| `savedquotes.js` / `savedquotes.html` / `savedquotes.css` | Saved quotes: logic, markup and styles pasted into all seven pages, so `test-savedquotes.mjs` has to find them unchanged |
| `snapshot.mjs` | Records transform output for a fixed corpus and seed set |
| `compare.mjs` | Diffs two snapshots and censuses output defects |
| `corpus.mjs` | The test inputs and seeds |
| `audit-rules.mjs` | Audits word lists: literal-ness, conflicts, self-prefixed values |
| `audit-cascades.mjs` | Finds rules whose replacement is also a match key |
| `trace.mjs` | Replays the transform chain one rule at a time |
| `inspect.mjs` | Shows transform output per page, or artefact context |
| `lookup.mjs` | Lists every rule matching a given literal, in engine order |
| `doubled.mjs` | Lists cases whose output contains a doubled word |
| `find-fusion.mjs` | Locates the step that introduces a fused comma |
| `prepush-check.mjs` | Pre-push audit: shared modal and Make Card wiring, removed pages, credential shapes, local machine paths, stray files |
| `engine-proto.mjs` | Standalone copy of the old engine, used by `test-engine.mjs` |
| `fix-yoda-wordbound.mjs` | One-off: added missing leading `\b` to 22 yoda rules |
| `.dashboard-modules.js` | Build intermediate written by `build-dashboard.mjs` (gitignored) |
| `.dashboard-style.css` | Build intermediate: extracted stylesheet (gitignored) |

`fix-yoda-wordbound.mjs` and `engine-proto.mjs` are historical scaffolding; the
rest are in active use.

## Reviewing an engine or data change

```bash
node tools/snapshot.mjs before.json     # before the change
# ... edit ...
node tools/snapshot.mjs after.json
node tools/compare.mjs before.json after.json
```

Shows the exact blast radius: which page, input and seed moved, plus a defect
census (doubled words, fused commas). `pick` is index-based, so removing or
reordering entries in a word list shifts every seeded output downstream — that is
expected; the diff tells you whether it is proportionate.

## Generated files in the repository

Never hand-edit these; the next build overwrites them:

- **`index.html`** — the side-by-side dashboard. `build-dashboard.mjs` copies each
  style page's dictionaries, engine, helpers and transform function verbatim, so
  the dashboard cannot drift from the pages. After editing any style page, run
  `npm run build`, then `verify-dashboard.mjs` (both are part of `npm test`).
- **`manifest.json` / `icon-180.png` / `icon-192.png` / `icon-512.png`** — produced
  by `build-icons.mjs`. The manifest object and the icon drawing code live in that
  script; edit there, not in the output.

`Screenshot.png` is the opposite: hand-maintained from a real browser. Only
`build-screenshot.mjs` regenerates it, only when run deliberately.

## Checking documentation against reality

- **`check-readme.mjs`** parses both example tables in `README.md` and checks each
  against real output across the corpus seeds. The transform is randomised, so an
  example is accepted if it matches *some* run. Run it after any change to a word
  list.
- **`readme-features.mjs`** confirms every string the feature bullets quote exists
  in the code, using array membership rather than sampling — a 5% insult roll over
  ~20 entries is ~0.25% per run and would need thousands of seeds to surface one
  specific entry. When checking a chance-gated string by sampling instead, the rate
  is `chance / array_length` per run, not `chance`.

## Determinism

Every style page seeds its own PRNG (mulberry32), so the same seed always yields
the same output. That is what lets `snapshot.mjs` and `compare.mjs` detect
regressions at all. Any new source of randomness must go through `rand()`, never
`Math.random()` — one unseeded call in page code silently voids the entire
regression suite.
