# AGENTS.md — Working on shakespeare-repriser

Read this before changing anything. The repo has hard invariants that tests
enforce; violating them fails `npm test` or corrupts generated files. After the
operational sections come the "why" content — engine design, content judgment
calls, known open work, git conventions and a compressed history.

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
     fallback/apple-touch/manifest). `manifest.json` in particular looks
     hand-written and is not: a direct edit renders, commits, deploys, then
     vanishes on the next `build-icons` run.
3. **`Screenshot.png` is hand-maintained**, not part of the suite. Regenerate
   only deliberately: `node tools/build-screenshot.mjs` (pins Math.random for
   reproducibility, drives headless Edge over CDP, waits for webfonts, skips
   cleanly if Edge is absent). It was once wired into the suite and silently
   overwrote the committed image every run — that is how a stale one survived
   a page removal.
4. **Determinism:** every style page seeds its own PRNG (mulberry32). Any new
   randomness must go through `rand()`, never `Math.random()` — one unseeded
   call voids the whole regression suite (`snapshot.mjs`/`compare.mjs`).
5. **Line endings:** generated output (`index.html`, `manifest.json`) is pure
   LF. The six style pages have mixed endings (~1088 CR bytes each from pasted
   blocks) — when splicing, be byte-precise; the tools are LF. If you add a
   generator, normalise on write and add it to `test-reproducible.mjs`.
6. **Design language:** parchment/medieval throughout; the six style pages
   share one visual template. Existing animation names: `quillBob`, `floatA`,
   `floatB`, `cardIn`, `outputGlow`, `btnSparkle`.

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
  → `node tools/compare.mjs before.json after.json` (blast radius + defect
  census). `pick` is index-based, so removing or reordering word-list entries
  shifts every seeded output downstream — that is expected; the diff tells you
  whether the shift is proportionate to the edit.

## Engine

- The replacement engine is a **single-pass longest-match**, not the old
  cascade of ~900 sequential whole-sentence regexes. It sits between banner
  comments (`// ============ REPLACEMENT ENGINE ============`) in each style
  page; `build-dashboard.mjs` extracts that block verbatim, so **if you change
  the engine, change all six pages**.
- The RNG is seeded mulberry32: each page has `_randomSeed`, `_rngState`,
  `seedRandom(seed)`, `rand()`, `pick(arr)`, `chance(p)`. The dashboard
  derives a per-run seed from `Math.random()` and advances it per click, then
  passes `(baseSeed + i) >>> 0` to each style. If a test fails
  nondeterministically, look for an unseeded `Math.random()` first.
- Quirk: seed state is initialised at parse time from the real clock before
  `seedRandom` runs, so the same engine+seed+input can differ across
  browsers. The suite runs in Node only; real-browser coverage is
  `browser-journeys.mjs` in headless Edge.

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

### Content judgment calls (from the project owner — do not "helpfully" undo)

`test-content.mjs` enforces the mechanical parts; the reasoning below is not
obvious from a diff and was settled deliberately:

- **Slavery is never a punchline.** The four Norse roasts that used
  `thrall`/`slave` were reworded to attack conduct instead ("withered old
  fool", "craven liar", …): it is not humour about a vice, it uses a real
  historical oppression as the punchline. The ban is **scoped to roasts on
  purpose** — two pirate quotes argue *against* slavery ("I'd rather be a free
  man…", "Better dead than to be a slave") and must stay; a blanket ban would
  delete them.
- **Drunkenness, filth and oath-breaker roasts were deliberately KEPT** (an
  earlier recommendation to strip them was wrong): drunkenness and disease
  imagery are in scripture, attacking liars and traitors is pro-virtue, and
  sanitising would gut Chaucer/Shakespeare/pirate voice — inauthenticity is
  its own disrespect. Shakespearean comic abuse ("thou knob of a dunghill")
  stays for the same reason.
- **Open judgment call:** `"ye cross-eyed bilge monkey"` (pirate) is allowed
  via the `ALLOWED` list in `test-content.mjs` and emits a standing `WARN` —
  judged Golden Age nautical ribaldry, no slur implication. The owner has not
  ruled; if you disagree, remove the line *and* the `ALLOWED` entry together.
- **Scans must use word boundaries.** Naive substring matching produced 18
  false positives: `arse` inside "co**arse**r", `prick` in *"the pricking of
  my thumbs"* (canonical Shakespeare), `slave` in the anti-slavery quotes,
  `damn` in *"Out, damned spot!"*. Every reviewed exception lives in
  `ALLOWED` with a written reason — new ones need a reason too. Secret
  scanning has the same trap (the dictionaries contain `secret`→`mystery`,
  `_TOKEN_CHAR`, the Chaucer phrase "with token and tryste"), so
  `prepush-check.mjs` matches credential *shapes*, not bare words.
- **Removed but recoverable:** a random picker page (`random.html` + 72
  authored compliments) shipped in `03a1ced` and was removed in `10d0e8a` at
  the owner's request, reason unknown — `git show 03a1ced` has the whole
  thing. Ask before rebuilding it.

## Known open work

- **193 of the 234 quotes are dead code.** Only `shakespeare.html` calls
  `pick(quotes)`; the other five pages define a `quotes` array that
  `maybeInsertQuote` never touches (hardcoded 2–4 item list instead). Counts:
  shakespeare 41 / pirate 31 / victorian 25 / chaucer 35 / yoda 72 /
  norse 30. The fix is one line per page but it is a **live behaviour change**
  that shifts seeded output — snapshot first for blast radius, and do not do
  it unasked.
- **Engine defect census:** 16 of 4176 cases contain a doubled word or
  repeat (victorian 3, yoda 4, norse 1, plus cross-variant doubles).
  `test-engine` reports it; not fixed.
- **Known cosmetic artefact:** a ~6px stray mark in the textarea of
  `Screenshot.png`, composited by headless Edge; survives
  `caret-color: transparent`, `cursor: none` and moving the virtual pointer.
  ~3px at README width. Documented rather than fixed — suppressing it is not
  worth the machinery.
- Layout had gone unverified in a real browser for a long time;
  `check-css.mjs` validates brace balance and query counts but cannot tell you
  a page *looks* wrong. If you change CSS, look at it.

## Testing

`npm test` = `tools/run-all.mjs`, which runs everything in
`tools/README.md`'s table in order. Highlights:

- `paste-shared.mjs --check` — pasted copies byte-match `tools/` sources.
- `verify-dashboard.mjs` — dashboard output matches every style page.
- `browser-journeys.mjs` — real headless Edge over CDP: transforms on every
  page, settings persistence, saved-quotes flow, card export, keyboard nav,
  responsive overflow, console errors. **Skips (exit 0) when Edge is absent.**
- `smoke-dashboard.mjs` ×3 — full DOM in a `vm` with a fake canvas at dpr
  1/2/3; exercises the modal via `initCardUI({ themes, render, download })`
  with injected fakes.
- `check-a11y.mjs`, `check-css.mjs` — static audits (labels, focus-visible,
  reduced-motion, brace balance).
- `test-settings.mjs`, `test-savedquotes.mjs`, `test-compare.mjs`,
  `test-cardpages.mjs` — byte-identical paste checks + behaviour.
- `test-links.mjs` — every local href resolves, all pages share one switcher.
  It was written *after* a missing-page-link mistake: deleting a page means
  deleting its switcher links on all 7 pages and in the README.

Last line of a green run: `working tree is ready to push`.

## Platform notes (this machine)

- **Windows / cmd.exe:** `&` splits commands; findstr garbles `//`; no
  `tail`/`rg` on PATH; **`node -e` with nested quotes fails silently — write a
  temp `.mjs` file** (scratch dir: any writable directory outside the repo,
  e.g. `%TEMP%`) and run it. Heredocs do not work either: `git commit -F -`
  with `<<EOF` fails — write the message to a file and use `git commit -F
  <path>`.
- **`edit` on files with CRLF endings can fail to match:** a large multi-line
  `oldString` written as LF will not match a file git normalised to CRLF.
  Prefer a small unique anchor, or write a script.
- **The live site lags the push.** GitHub Pages takes a minute or two; a
  screenshot taken from the live URL shows the *previous* deploy (this is how
  a screenshot advertising a deleted page got committed). For a current shot,
  use the local file (`file:///<repo-root>/index.html`).
- Edge: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` (or the
  x64 path). CDP harnesses use ports 9333–9338; `connect()` delivers events
  to `on(fn)` listeners.

## Git conventions

- **Only commit when the owner explicitly asks.** This has been restated more
  than once and is checked. When you want to commit, ask.
- Do not force-push, amend, or rewrite published history unless asked;
  `git push` only on explicit instruction — publishing is the owner's call.
- The owner commits directly too: re-read `git status` and `git log` before
  assuming you know the state — they take screenshots and make commits
  mid-session.
- Commit style: imperative title, blank line, wrapped prose body ~80 columns.
  No conventional-commit prefixes.
- Run `node tools/prepush-check.mjs` after committing, before any push.

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
| `AGENTS.md` | This file — invariants, workflow, judgment calls, history |
| `README.md` | User-facing docs; its tables are test-checked |
| `LICENSE` | Terms above |

## History (compressed)

- The cascade engine was replaced with the single-pass longest-match and the
  dashboard added in one commit (`da63c44`); the manifest + PNG icons for
  installability followed (`f84b7cc`). The random picker (`03a1ced`) bundled
  three unrelated things — the picker, the content cleanups above, and the
  shared `cardui.js` modal — so **never `git revert` it wholesale**; removing
  the picker needed its own commit (`10d0e8a`).
- `tools/` originally lived outside the repo (in a `Github stuff` folder) and
  was moved in on 2026-10-07 when the owner wanted it published with the
  site; the handoff notes (formerly `Plan.md`, local-only) were merged into
  this file on 2026-10-16.
- Since then: the standalone-pages + paste-shared workflow, the compare view,
  saved quotes, quote-card export, transformation settings (intensity slider
  + round checkboxes), the SVG favicon, and this file's own merge.
