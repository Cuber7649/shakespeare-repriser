# AGENTS.md — Working on shakespeare-repriser

Read this before changing anything. The repo has hard invariants that tests
enforce; violating them fails `npm test` or corrupts generated files.

## What this is

A collection of seven single-page web apps (dashboard + six styles) that
rewrite modern English into literary/historical styles. Everything runs
client-side; zero dependencies; no build toolchain beyond plain Node scripts
in `tools/`. Live on GitHub Pages.

## Architecture invariants

1. **Every `.html` page is fully standalone.** Shared logic lives once under
   `tools/` and is pasted **verbatim** into each page by
   `tools/paste-shared.mjs` — 13 blocks: six JS (`options.js`,
   `savedquotes.js`, `compare.js`, `cardui.js`, `cardpage.js`, `quotecard.js`),
   four CSS (`options.css`, `savedquotes.css`, `compare.css`, `card-modal.css`),
   three HTML (`options.html`, `savedquotes.html`, `card-modal.html`).
   Edit the file under `tools/`, never the pasted copy inside a page.
2. **Never hand-edit generated files:**
   - The pasted copies inside the six style pages.
   - `index.html` — built from the style pages by `tools/build-dashboard.mjs`
     (`npm run build`); copies each page's dictionaries, engine, helpers and
     transform function verbatim so the dashboard cannot drift.
   - `manifest.json`, `icon-180/192/512.png`, `icon.svg` — drawn by
     `tools/build-icons.mjs` from shared `GEO` constants (round medallion on a
     square canvas; maskable-safe; SVG is the primary favicon, PNGs are
     fallback/apple-touch/manifest).
3. **`Screenshot.png` is hand-maintained**, not part of the suite. Regenerate
   only deliberately: `node tools/build-screenshot.mjs` (pins Math.random for
   reproducibility, drives headless Edge over CDP, waits for webfonts, skips
   cleanly if Edge is absent).
4. **Determinism:** every style page seeds its own PRNG (mulberry32). Any new
   randomness must go through `rand()`, never `Math.random()` — one unseeded
   call voids the whole regression suite (`snapshot.mjs`/`compare.mjs`).
5. **Line endings:** generated output (`index.html`, `manifest.json`) is pure
   LF. The six style pages have mixed endings (~1088 CR bytes each from pasted
   blocks) — when splicing, be byte-precise; the tools are LF.

## Workflow

```bash
# 1. Edit the source under tools/ (never a pasted copy or a generated file)
# 2. Repaste shared blocks into all pages + rebuild the dashboard:
node tools/paste-shared.mjs
# 3. Run the full suite (~2 min; build + 24 checks):
npm test
# 4. Commit, then:
node tools/prepush-check.mjs   # MUST run AFTER committing (staleness vs HEAD)
```

- `npm run build` alone regenerates only `index.html`.
- No `npm install` — there are no dependencies. Node built-ins only.
- Any individual script runs directly, e.g. `node tools/verify-dashboard.mjs`.
- Review engine/word-list changes with the snapshot diff:
  `node tools/snapshot.mjs before.json` → edit → `node tools/snapshot.mjs after.json`
  → `node tools/compare.mjs before.json after.json` (blast radius + defect census).

## Content rules

- **Family-friendly** everywhere: no profanity, slurs, or explicit material;
  `test-content.mjs` enforces this over every displayable line.
- **No emoji in UI** — use HTML entities (e.g. `&#128220;`) if a pictogram is
  needed; literal emoji characters fail review/tests.
- **Voice:** literary/historical parody, warm not mean. Insults stay playful.
- README examples must match real output — `check-readme.mjs` parses both
  example tables and checks them across corpus seeds (any matching run passes,
  since output is randomised). `readme-features.mjs` verifies every feature
  bullet's quoted strings exist in the code.

## Testing

`npm test` = `tools/run-all.mjs`, which runs everything in
`tools/README.md`'s table in order. Highlights:

- `paste-shared.mjs --check` — pasted copies byte-match `tools/` sources.
- `verify-dashboard.mjs` — dashboard output matches every style page.
- `browser-journeys.mjs` — real headless Edge over CDP: transforms on every
  page, settings persistence, saved-quotes flow, card export, keyboard nav,
  responsive overflow, console errors. **Skips (exit 0) when Edge is absent.**
- `check-a11y.mjs`, `check-css.mjs` — static audits (labels, focus-visible,
  reduced-motion, brace balance).
- `test-settings.mjs`, `test-savedquotes.mjs`, `test-compare.mjs`,
  `test-cardpages.mjs` — byte-identical paste checks + behaviour.

Last line of a green run: `working tree is ready to push`.

## Platform notes (this machine)

- **Windows / cmd.exe:** `&` splits commands; findstr garbles `//`; no
  `tail`/`rg` on PATH; **`node -e` with nested quotes fails — write a temp
  `.mjs` file** (scratch dir: `C:\Users\blink\AppData\Local\Temp\opencode\`)
  and run it.
- Edge: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` (or the
  x64 path). CDP harnesses in the temp dir use ports 9333–9338; `connect()`
  delivers events to `on(fn)` listeners.
- Git: commit messages in the repo's style (`Fix …`, `Add …`, one sentence);
  do not push unless asked; `prepush-check.mjs` after commit, before push.

## License

`LICENSE` (also reflected in `package.json` as `"SEE LICENSE IN LICENSE"`):
free use; commercial use requires crediting
[github.com/Cuber7649](https://github.com/Cuber7649) and linking the project
[github.com/Cuber7649/shakespeare-repriser](https://github.com/Cuber7649/shakespeare-repriser);
non-commercial needs no attribution; AS-IS disclaimer. Do not relicense.

## Where things live

| Path | Role |
| ---- | ---- |
| `shakespeare.html`, `pirate.html`, `victorian.html`, `chaucer.html`, `yoda.html`, `norse.html` | The six style apps (standalone) |
| `index.html` | Dashboard (generated) |
| `tools/` | All build + test scripts; shared-block sources; see `tools/README.md` |
| `tools/corpus.mjs` | Test inputs and `SEEDS` |
| `tools/engine-proto.mjs` | Frozen old engine for `test-engine.mjs` |
| `AGENTS.md` | This file |
| `README.md` | User-facing docs; its tables are test-checked |
| `LICENSE` | Terms above |
