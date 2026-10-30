# TODO — working through the review

Derived from `improve-1.md` and `improve-2.md`. Decisions taken: Yoda stays
accuracy-first (light touch) and gets a documented, tested contract; scope is
"everything remaining".

Baseline before edits: `npm test` green (26 steps), snapshot saved to
`%TEMP%/opencode/before.json` (4284 cases).

## Phase 1 — Grammar (improve-1) — DONE

- [x] **1. Pronoun case.** `fixPronounCase()` flips subject `thou` to object
      `thee` after prepositions and transitive verbs. Shakespeare and Chaucer
      define `pronounCase`; the other styles set it to `null`.
- [x] **2. Filler placement.** `maybeAddFiller` only inserts at a clause
      boundary (opening, or after a comma), never inside a noun phrase, an
      auxiliary+verb, or after the final stop.
- [x] **3. Insertion budget.** One `budget` object is shared by openings,
      mid-sentence insertions, filler, metaphor, alliteration, parenthetical
      and insult, so a sentence cannot stack them.
- [x] **4. Clause-scoped inversion.** `maybeInvert` cuts at a comma, semicolon,
      colon or coordinating/subordinating conjunction and inverts only the
      main clause.
- [x] **5. Person agreement.** `fixAgreement()` applies per-page rules:
      `I doth` → `I do`, `thou doth` → `thou dost`, `he wast` → `he was`,
      `I canst` → `I can`, `thou shall` → `thou shalt`, etc.
- [x] **6. Intensity dedupe.** `dedupeIntensity()` collapses stacked
      intensifiers in one small window.
- [x] **7. Yoda contract.** README + AGENTS state that Yoda only reorders clear
      clauses; `test-yoda.mjs` locks both the reorderings and the no-op cases.
- [x] **8. `tools/test-grammar.mjs`.** Banned-pattern checks over all six styles
      × corpus × seeds, plus structural checks for stacked inserts and
      clause-crossing inversions. Wired into `tools/run-all.mjs`; 0 hits across
      4,284 outputs.

## Phase 2 — Docs and claims (improve-2) — DONE

- [x] **9. Stale counts.** README/tools README/AGENTS now say 30 steps and 14
      shared blocks.
- [x] **10. Stale RNG note.** AGENTS corrected: seed state starts at 0 and
      advances per click; no clock seeding. The optional Seed field is
      documented.
- [x] **11. Drift + browser claims.** Reworded to what `verify-dashboard` and
      the headless-Edge suite actually test; the pasted-code tradeoff is
      stated in the README.
- [x] **12. `WORDLISTS.md`.** Dictionary format, engine order, adding an entry,
      traps, and the snapshot workflow.
- [x] **13. `CONTENT_POLICY.md`.** Family-friendly definition, blocklist and
      exceptions, servitude scope, settled judgement calls, open `bilge
      monkey` question.
- [x] **14. `npm run check-words`.** `tools/check-words.mjs`, sharing
      `tools/content-policy.mjs` with `test-content.mjs`; `--roast` applies the
      servitude rule and literal emoji are flagged.
- [x] **15. `DEVELOPMENT.md`.** Adding a style, dictionary format, pipeline
      order, settings effects, edge-case contract, running one test.
- [x] **16. `CONTRIBUTING.md`.** Links to AGENTS/DEVELOPMENT/CONTENT_POLICY and
      the required pre-PR steps.
- [x] **17. README example generator.** `check-readme.mjs --write` regenerates
      both tables at the canonical seed (2); the check still accepts any seed.

## Phase 3 — Tests and features — DONE

- [x] **18. Style overlap report.** `check-style-overlap.mjs` reports shared
      replacement values and fails when one README input documented for two
      styles produces the same line. The duplicate Victorian/Norse example was
      replaced with `the warrior is strong` → Norse `The berserker is mighty`.
- [x] **19. Seed control.** Optional Seed field on all six pages and the
      dashboard, persisted with the other settings; same seed + input +
      settings replays a run. Covered by `test-settings.mjs`.
- [x] **20. Edge cases.** `test-edgecases.mjs` covers empty, whitespace,
      punctuation, numbers, emoji, RTL, markup-like text, bracket text,
      paragraphs, 10k characters, 5k words and a 5k-character word.
- [x] **21. Performance + size budget.** `test-budgets.mjs` records 100-word and
      5,000-word timings and fails at 220 KB per style page or 520 KB for the
      dashboard.
- [x] **22. Accessibility gap list.** `ACCESSIBILITY.md` records the target,
      automated checks and gaps (no axe/screen-reader/contrast audit).
      Decorative icon spans now carry `aria-hidden="true"`, enforced by
      `check-a11y.mjs`.
- [x] **23. Offline behaviour.** `browser-journeys.mjs` blocks the Google Fonts
      CDN, confirms the page still transforms and uses a serif fallback; the
      README already states the fallback.
- [x] **24. Dashboard copy fallback.** `build-dashboard.mjs` now mirrors the
      style pages' hidden-textarea fallback and `.catch()`.

## Phase 4 — Verification

- [x] **25.** `node tools/paste-shared.mjs` run after shared-block edits.
- [x] **26.** `npm test` green, including the new grammar, edge, overlap and
      budget steps.
- [x] **27.** `node tools/snapshot.mjs after.json` +
      `node tools/compare.mjs before.json after.json`: 1,824/4,284 outputs
      changed (Yoda 3), defect census unchanged at 9 → 9. The change is the
      insertion budget (one decoration per sentence) plus the grammar passes,
      which is the intended blast radius.
- [x] **28.** `node tools/prepush-check.mjs` after committing: passed (`working
      owner has not asked for a commit.
- [x] **29.** Commit `b7dc2d3` made on `main`; no push (publishing is the owner's call).

## Deliberately not doing

- **Localization (item 25).** Optional, and transformation output is
  English-only by design. The new seed label is the only new UI string.
- **TypeScript / `tsc --checkJs` (item 21).** A dev dependency would break the
  zero-dependency rule for no runtime benefit. JSDoc types remain comment-only
  in `tools/harness.mjs`.
- **Playwright/Firefox/WebKit (items 11–12 beyond Edge).** Would add a runtime
  dependency; `browser-journeys.mjs` remains the real-browser gate, and the
  README says Firefox/Safari are expected but untested.
- **axe-core (item 22).** Same dependency rule. `ACCESSIBILITY.md` records the
  gap; the static audit and keyboard journey cover what can be checked without
  a dependency.
