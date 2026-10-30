# Contributing

Thanks for taking a look. This project is a set of standalone, zero-dependency
pages, and the hard rules below exist to keep it that way.

## Read first

- [`AGENTS.md`](./AGENTS.md) — invariants, workflow, settled judgement calls.
- [`DEVELOPMENT.md`](./DEVELOPMENT.md) — how the engine and generators work.
- [`CONTENT_POLICY.md`](./CONTENT_POLICY.md) — what may ship in a quote or roast.
- [`WORDLISTS.md`](./WORDLISTS.md) — dictionary format and how to add an entry.

## Before you open a pull request

1. Edit the source: a style page for vocabulary, `tools/` for shared logic.
2. If shared code changed, paste it into the pages:
   `node tools/paste-shared.mjs`
3. Rebuild the dashboard: `node tools/build-dashboard.mjs`
4. Run the whole suite: `npm test`
5. Check a new word or line against the content policy:
   `npm run check-words -- "the new line"` (add `--roast` for a roast)
6. If you changed word lists, include a snapshot diff:
   `node tools/snapshot.mjs before.json`, edit,
   `node tools/snapshot.mjs after.json`,
   `node tools/compare.mjs before.json after.json`
7. Do not commit or push unless the owner asks. When asked, commit first and
   then run `node tools/prepush-check.mjs`.

The suite must be green. A change that adds a runtime dependency to a shipped
page will be declined; tooling may use Node built-ins only.

## Rules that are easy to miss

- Never edit `index.html`, `manifest.json`, the icons, or a pasted copy of a
  shared block. They are generated. Edit `tools/` and regenerate.
- Never use `Math.random()` in a page. All randomness goes through the seeded
  `rand()`/`pick()`/`chance()` helpers, or the regression suite is void.
- No emoji in UI text; use HTML entities.
- Family-friendly means no profanity, explicit material or slurs. Playful
  historical insults are fine. Slavery is never a roast punchline.
- Keep Yoda conservative: it reorders clear clauses and leaves prose it cannot
  parse safely in its original order. Do not loosen the object guard to make a
  test pass.

## Commit style

Imperative title, blank line, prose body wrapped at about 80 columns. No
conventional-commit prefixes. Do not rewrite published history.

## License

By contributing you agree that your contribution is licensed under the terms in
[`LICENSE`](./LICENSE): free use, with credit and a link required for commercial
use.
