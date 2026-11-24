# Todo

Work list from a full read of `tools/` and the docs at commit b8ebebc.
Nothing here is speculative unless it says "confirm first".

Read `AGENTS.md` before starting. The rules below are the short version.

## Outcome

All items in this list are done. Owner decisions: shared links apply for one run only
and no longer call optSave; the card keeps inline bracketed text written by the
writer and only strips line-standing authored stage directions; test-content.mjs
honours ALLOWED. No commit was made, as requested.

Verification: `REQUIRE_BROWSER=1 npm test` is green (32 steps, browser leg run),
`node tools/check-contrast.mjs` passes and fails on a restored old colour, and
the before/after snapshot diff reports 0 changed cases out of 4284.

## Rules for this work

- Edit sources under `tools/`. Never edit a pasted copy inside a page.
- Never hand-edit `index.html`, `manifest.json`, or any `icon-*` file.
- After changing a shared block, run `node tools/paste-shared.mjs`. It repastes
  all six style pages and rebuilds the dashboard.
- After changing `tools/build-dashboard.mjs`, run `npm run build`.
- `sw.js`, `package.json`, the docs and the six pages' own markup and CSS are
  hand-written. Edit those directly.
- All randomness goes through `rand()`, never `Math.random()`.
- No literal emoji in UI text. Use numeric HTML entities.
- Keep Yoda conservative. Do not loosen the object guard.
- Do not commit or push. Leave the tree dirty and report.
- Windows: write a temp `.mjs` file instead of `node -e` with nested quotes.
  Keep scratch files outside the repo.

## Confirm first

- [x] **Re-run may be dead on the six style pages.** `sqRerun` in
  `tools/savedquotes.js` looks for `#go`, then falls back to
  `.btn-primary[onclick]`. The dashboard has `#go`. Open `shakespeare.html` and
  check whether the Transform button carries an `onclick` attribute. If it does
  not, the fallback finds nothing and every style page reports "Re-run is not
  available on this page". Fix by giving the shared block a stable hook: look
  for `.btn-row .btn-primary` as a second fallback, matching what
  `browser-journeys.mjs` and `sharelink.js` already click.
  Done when Re-run works on a style page and a test covers it.

- [x] **Check for a page-local placeholder rule.** Grep the six pages for
  `:empty::before`. The dashboard placeholder lives in `build-dashboard.mjs`.
  If the pages carry their own copy, it needs the same colour fix.

## Behaviour

- [x] **Compare panels go stale.** Nothing re-renders an open panel after a new
  transform, and dashboard Clear leaves panels open. Fix inside
  `tools/compare.js` so no page edits are needed: have `initCompareUI` attach a
  `MutationObserver` to each output node and re-render any panel whose
  `aria-expanded` is true. Guard on `typeof MutationObserver` so the Node
  harness still loads. Empty output should show the empty message, not the old
  diff.
  Done when a second transform updates an open panel, and Clear resets it.

- [x] **Re-run's message is wrong.** `sqRerun` ends with "Re-transformed with
  the original style and settings" even on the fallback path, where the page's
  own style runs. A Pirate quote re-run on `shakespeare.html` comes back
  Shakespearean. Make the message state what actually happened, or refuse the
  re-run when `item.style` does not match the page and say which page to open.
  Pick one and note the choice in the file comment.

- [x] **Re-run does not persist restored settings.** `sqRerun` calls `optApply`
  but not `optSave`. `shareApply` does both. Make them consistent.

- [x] **Use and Re-run leave the character counter stale.** Both set
  `input.value` directly. Dispatch an `input` event after setting it, the way
  `shareApply` does, so the page's own counter listener fires. Guard on
  `typeof Event`.

- [x] **No cross-tab sync for saved quotes.** `sqReload` exists but nothing
  listens for the `storage` event, so two open tabs overwrite each other and
  lose quotes. Add a `storage` listener in `tools/savedquotes.js` that calls
  `sqReload()` when `event.key === SQ_KEY`. Guard on
  `typeof window !== 'undefined' && typeof window.addEventListener === 'function'`
  so the harness does not throw.

- [x] **Same gap for settings.** Add a `storage` listener in `tools/options.js`
  that re-applies stored options when `event.key === OPTS_KEY`. Same guard.

- [x] **A search with no matches shows a blank list.** In `sqRender`,
  `empty.hidden` follows `sqItems.length`, not the filtered row count. Drive it
  from the rendered rows and show a different message when the list is non-empty
  but nothing matched.

- [x] **The Save icon is a telephone receiver.** `tools/savedquotes.js` resets
  the button to `&#128222;` after every save, on all seven pages.
  `build-dashboard.mjs` uses it too. Change both to `&#128190;` and update the
  matching markup in the six style pages so the first render agrees.

- [x] **Surprise Me and Make Card share the pushpin.** Both use `&#128204;` on
  the dashboard. Give Surprise Me `&#127922;` in `build-dashboard.mjs` and in
  the six pages' own button markup. Leave Make Card as it is.

- [x] **The service worker's cache write is not waited on.** In `sw.js`,
  `caches.open(CACHE_VERSION).then(put)` sits outside `event.waitUntil`, so the
  write can be killed when the worker terminates. Wrap it in
  `event.waitUntil`.

- [x] **Share links accept a fractional seed.** `shareDecode` accepts `d=1.5`,
  then `optSeedValue` rejects it and the seed vanishes. Reject non-integers in
  `shareDecode` and add a case to `test-sharelinks.mjs`.

## Contrast

Measured against WCAG AA. All of these are text below 24px, so the bar is 4.5:1.
Every failing pair lives in a shared block or in `DASH_CSS`, so this is a
`tools/` job plus a repaste.

| Where | Now | Worst | Use |
| --- | --- | --- | --- |
| `.out:empty::before` in `build-dashboard.mjs`, `.saved-quotes-empty`, `.saved-quotes-field::placeholder` | `#b8956a` | 2.29 | `#755f43` |
| `.saved-quotes-action`, `.saved-quotes-use`, `.saved-quotes-rerun`, `.saved-quotes-del` | `#8b6d4a` | 3.74 | `#73593c` |
| `.mini-link`, `.modal-note`, `.saved-quotes-title`, `.saved-quotes-style` | `#8a6a3a` | 4.09 | `#7d5f33` |
| `.options-hint` | `#7a6248` | 4.38 | `#745c43` |

The replacements measure 4.79 to 4.95 at their worst background stop, so there
is headroom. Files: `tools/savedquotes.css`, `tools/options.css`,
`tools/card-modal.css`, and `DASH_CSS` in `tools/build-dashboard.mjs`.

- [x] Change only `color:` declarations that paint text. Leave the
  `rgba(138,106,58,...)` and `rgba(184,149,106,...)` border and hover fills
  alone. Those are non-text.
- [x] Leave `CARD_LABEL_INK` in `tools/quotecard.js` alone. It is large text on
  the card, held to 3:1, and it already passes.
- [x] Grep all seven pages and `tools/` for the four old hex values and check
  every remaining text use against its real background.
- [x] `.saved-quotes-use:hover` measures 4.51, which is tight. Nudge it darker
  while you are there.

- [x] **Add `tools/check-contrast.mjs`.** Zero dependencies. Lift `srgb`,
  `lumOf` and `contrastRatio` out of `test-quotecard.mjs` into a shared
  `tools/contrast.mjs`, and point both at it. The new check parses the shared
  CSS blocks and `DASH_CSS`, pairs each text colour with its background
  including gradient stops and alpha blends, and fails below the bar for its
  font size. Add it to `STEPS` in `run-all.mjs` and to the table in
  `tools/README.md`.
- [x] Update `ACCESSIBILITY.md`. "Contrast is not measured" stops being true.

## Tests that cannot fail

- [x] **`CARD_DPR_CAP` is not exported.** `test-quotecard.mjs` reads
  `Q.CARD_DPR_CAP || 2`, so it always reads 2 and the cap assertion is
  self-fulfilling. Export it from `quotecard.js` and drop the fallback.
- [x] **The default card skin is never contrast-checked.** `test-quotecard.mjs`
  loops `CARD_SKINS` only. Add `CARD_THEMES`, which is what `auto` uses. It
  passes today at 3.36 to 3.72 against the 3.0 large-text bar. Lock it in.
- [x] **`test-surprise.mjs` resets a snapshot.** The harness hands out top-level
  `let` bindings by value, so `api.surpriseLastIndex = -1` does nothing. Add a
  `surpriseReset()` to `tools/surprise.js` and call that instead. Add a comment
  in `harness.mjs` explaining the snapshot so nobody repeats it.
- [x] **Compare's button wiring is never exercised.** The harness has no
  `querySelector`, the smoke stub returns `[]` for `[data-compare]`, and
  `browser-journeys.mjs` never clicks Compare. Add a browser journey: open a
  panel, transform again, assert the panel changed.
- [x] **No Re-run test anywhere.** Add one to `test-savedquotes.mjs` for the
  dashboard hook path, and a browser journey for the style page path.
- [x] **`test-reproducible.mjs` covers only `index.html`.** Add `manifest.json`
  and the five icons. Group them by builder so `build-icons.mjs` runs once, not
  once per file.
- [x] **`prepush-check.mjs` claims more than it checks.** It prints "rebuilds
  byte-identically" from an exit code. The byte comparison is really the
  `git diff HEAD` below it. Reword the label.
- [x] **`arraysFrom` uses `eval` with a string-blind bracket counter** in
  `test-content.mjs` and `check-style-overlap.mjs`. A `]` inside a string ends
  the scan early. Reuse `extractDecl` from `page-source.mjs` and run the result
  in a `vm` context instead.
- [x] **`audit-rules.mjs` misreports rules with digits.** Its `LITERAL` and
  `WORDY` patterns omit `0-9` and `_`, unlike the engine's `PURE_LITERAL`.
  Import the pattern from `engine-proto.mjs` so they cannot drift.
- [x] **`verify-dashboard.mjs` throws ENOENT on a fresh clone.** It reads the
  gitignored `.dashboard-modules.js`. Build it when missing, or fail with
  "run npm run build first".
- [x] **`test-manifest.mjs` prints a pass after a failure.** The "declared icon
  sizes match" line runs unconditionally. Move it into an else.

## Docs

- [x] `AGENTS.md` and `DEVELOPMENT.md` say a green run ends with
  "working tree is ready to push". `run-all.mjs` prints "all steps passed".
  That other line belongs to `prepush-check.mjs`. Fix both.
- [x] `DEVELOPMENT.md` says Node 18+. The CDP harness needs the global
  `WebSocket`, stable from 22. On 18 and 20 the journeys fail rather than skip.
  Fix the doc, add `"engines": { "node": ">=22" }` to `package.json`, and make
  `browser-journeys.mjs` skip with a clear message when `WebSocket` is
  undefined.
- [x] `DEVELOPMENT.md` "Adding a style" lists about 20 files to edit. Most now
  derive from `tools/styles.mjs`. Rewrite the list to the real manual steps:
  the page, the switcher links on all seven pages, `CARD_THEMES` in
  `quotecard.js`, the `sw.js` cache entry, the README rows, and the corpus.
- [x] Stale references to the deleted `random.html` and `build-random.mjs` in
  `build-dashboard.mjs`, `page-source.mjs`, `check-css.mjs` and
  `test-reproducible.mjs`.
- [x] `run-all.mjs` still calls Edge the primary browser. Chrome is primary.
- [x] `test-links.mjs` says the switcher has nine entries. It has seven.
- [x] `README.md` says pages are about 150 KB. Yoda is about 188. The structure
  list omits `icon-round-192.png`, `icon-round-512.png`, `sw.js` and
  `.github/workflows/`.
- [x] `compare.js` says the LCS table is about a megabyte at the cap. At 1200
  words it is 2.9 MB.
- [x] `DEVELOPMENT.md`'s repository table omits `sharelink.js`, `sw-register.js`
  and `styles.mjs`.
- [x] **The suite step count changes.** Adding `check-contrast` makes it 32.
  Update every place that says 31: `README.md` (two spots), `AGENTS.md`,
  `DEVELOPMENT.md`, `tools/README.md`.

## Deploy and CI

- [x] CI runs twice on same-repo pull requests. `on: push` has no branch
  filter. Scope it to `main`.
- [x] `prepush-check.mjs` scans 3 of the 11 markdown docs for secrets and local
  paths. Scan all root `.md` files plus `tools/README.md`.
- [x] `test-links.mjs` expected targets omit `icon.svg`, `icon-round-192.png`
  and `icon-round-512.png`.
- [x] **Bump `CACHE_VERSION` in `sw.js` to v5 once, at the end.** Every fix here
  changes a cached file. Without the bump, returning visitors keep the old
  pages.

## Owner decisions, do not guess

- [x] `shareApply` calls `optSave`, so opening a shared link overwrites your
  saved settings for every page. Ask whether a link should change your prefs
  or apply for that run only.
- [x] `stripStageBusiness` removes a user's own `[bracketed]` text along with
  authored stage directions. The transform keeps it, the card drops it. Ask
  whether to document that or narrow the pattern.
- [x] `test-content.mjs` imports `ALLOWED` but never applies it, while
  `check-words.mjs` does. No line hits today, so it is latent. Ask whether the
  test should honour exemptions or the docs should say it does not.

## Won't fix

- The 6px stray mark in `Screenshot.png`. Already documented in `AGENTS.md`.
  Do not regenerate the screenshot as part of this work.

## Verification

Run these before reporting done.

```
node tools/snapshot.mjs <tmp>/before.json   # first, before any edit
node tools/paste-shared.mjs
npm test
node tools/snapshot.mjs <tmp>/after.json
node tools/compare.mjs <tmp>/before.json <tmp>/after.json
```

- [x] `npm test` green, with the browser leg actually run, not skipped.
- [x] The snapshot diff reports zero changed cases. None of this work should
  change transform output. If a case moved, find out why before continuing.
- [x] `node tools/check-contrast.mjs` passes and fails when you deliberately
  restore one old colour.
- [x] Commit only when the owner asks. Then run
  `node tools/prepush-check.mjs` after committing.
