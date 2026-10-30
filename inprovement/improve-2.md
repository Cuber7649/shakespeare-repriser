# Improvements for shakespeare-repriser

Target: https://github.com/Cuber7649/shakespeare-repriser

Context: this list was written from the README and the public HTML of `shakespeare.html` and `index.html`. The `tools/` directory and the test scripts were NOT read, and the test suite was NOT run. Before changing anything, confirm each item against the actual code. Where an item says "verify", check first and only then change code.

Rules for the agent:
- Run `npm test` before and after every change. Record the baseline result first.
- Edit the source under `tools/` or the style pages, never the pasted copies. After editing shared code, run `node tools/paste-shared.mjs`, then `npm run build`, then `npm test`.
- Do not edit `index.html` directly. It is generated.
- Keep the family-friendly rule: no new word may be profane, slurred, or explicit.
- Keep the zero-dependency rule for the shipped pages. Test tooling may add dev dependencies only if they are not needed by the shipped HTML.

---

## P0: Documentation accuracy

### 1. Fix the Yoda example mismatch
- Earlier README snapshots show `you are brave` → `Are you brave` and later ones show `Brave, you are`.
- Verify: run the Yoda transform on `you are brave` several times and compare with the README.
- Fix: make the README example match real output, or make the code match the intended rule. Pick one and state it.

### 2. Fix the Victorian and Norse identical output
- The README example `we will travel tomorrow and find the treasure` gives the same output in Victorian and Norse.
- Verify: check whether the two styles share a word list or a phrase table, and how much of each is unique.
- Fix: either give the styles distinct vocabulary, or document that they share the transformation for this input and why.

### 3. Generate README examples from the code
- Verify: check whether the README examples are maintained by hand.
- Fix: add a script that runs each README example through the engine with a fixed seed and fails `npm test` if the output differs from the README table. Regenerate the README table from that script.

### 4. Soften or back up the drift claim
- README says the dashboard cannot drift from the pages.
- Fix: reword it to say that drift is detected by `paste-shared --check`. Use the same wording in the README and in `AGENTS.md`.

### 5. Soften or back up the browser claim
- README says "Works in all modern browsers" but also says the automated suite runs only in headless Chromium and Edge.
- Fix: reword to "Tested in Chromium and Edge. Expected to work in Firefox and Safari, not yet tested." Or add the tests from item 12.

### 6. Document the tradeoff of pasted shared code
- Shared logic is pasted into all seven pages, about 140 KB each.
- Fix: add a short paragraph to the README stating this is deliberate (self-contained files, no build for end users) and what it costs (larger files, more places to update).

---

## P1: Testing that backs the claims

### 7. Test the transformation engine with fixed seeds
- Verify: check whether the engine accepts a seed or random source. If it calls `Math.random()` directly, that must change first.
- Fix: inject a random source. Default to `Math.random`. Tests pass a seeded generator.
- Add: golden-output tests for each style on a fixed list of inputs, including all README examples.

### 8. Add a seed option for users
- Fix: expose a seed in the UI (optional field, or a "Copy seed" value shown with each output). Same seed plus same input plus same settings must give the same output.
- This also supports sharing a specific result.

### 9. Property test: Surprise Me never repeats
- README: "The same sentence never appears twice in a row."
- Test: call the Surprise Me selector 1000 times and assert no consecutive duplicates. Include the case where the list has only one or two sentences, and define what should happen.

### 10. Property test: quote card text never goes below readable size
- README: "Long text shrinks to fit the card (never below a readable size)."
- Verify: find the minimum font size constant in the code. Check that it is a real floor, not a suggestion.
- Test: generate long, short, and emoji-heavy strings and assert the computed font size is at or above the floor, and that the warning appears when shrinking is large or the text is cut.

### 11. Real browser tests with Playwright
- Test at mobile (375 px), tablet (768 px), and desktop (1280 px) widths. Check that the page has no horizontal scroll and that the transform button is visible.
- Test the full flow: type text, press Ctrl+Enter, see output, click Copy, click Save, reload, confirm the saved quote persists.
- Test the Compare view: the diff marks changed words.
- Test the quote card: open the modal, change skin and background, confirm the preview updates.

### 12. Cross-browser runs
- Add Firefox and WebKit to the Playwright config. Run the same suite on each.
- Record any failures in the README rather than hiding them.

### 13. Clipboard on file://
- README says copy works on local files. Browsers often block `navigator.clipboard` on `file://`.
- Verify with a real browser test on `file://`.
- Fix: if it fails, add a fallback using `document.execCommand('copy')` on a hidden textarea, or change the README to say HTTPS only.

### 14. Test saved-quote import and export
- Cover: export produces `repriser-quotes.json`; import reports added and skipped counts; duplicates are skipped; malformed files are rejected with a message; the 50-item cap is enforced and newest entries are kept.

### 15. Test settings persistence
- Cover: intensity and toggles are saved under `repriser.settings`, shared across pages on the same origin, and restored by Reset to the defaults.

---

## P2: Word lists and content policy

### 16. Document how word lists work
- Write `WORDLISTS.md` covering: the dictionary format, how a new entry is added, which style each list belongs to, and where the phrase and sentence rules live.

### 17. Document the family-friendly filter
- Verify: read the filter test in `tools/` and record exactly what it checks (blocklist, allowlist, or both).
- Write `CONTENT_POLICY.md`: what counts as family-friendly, the blocklist location, how to request an exception, and example rejected terms with reasons.
- Add a script, `npm run check-words`, that runs the filter on a candidate word or line without running the whole suite.

### 18. Check for accidental overlap between styles
- Add a test that reports words shared between styles, so overlap is visible and intentional (see item 2).

---

## P3: Developer experience

### 19. Add DEVELOPMENT.md
- Sections: how to add a new style (step by step), dictionary format, transform engine order of steps, how each setting affects output, how to run a single test.

### 20. Add CONTRIBUTING.md
- Link to `AGENTS.md`, `DEVELOPMENT.md`, and `CONTENT_POLICY.md`. State the required steps before a PR: edit `tools/`, run `paste-shared`, build, test.

### 21. Add type annotations
- Option A: JSDoc `@typedef` for the transform input, settings, and output, checked with `tsc --checkJs --noEmit` as a dev-only step.
- Option B: move `tools/` to TypeScript and compile to the pasted JS.
- Start with A because it has no runtime impact.

### 22. Accessibility checks
- Add axe-core to the Playwright suite. Run it on each page and the dashboard.
- Document the target level (suggest WCAG 2.1 AA) and list known gaps.
- Mark decorative emoji with `aria-hidden="true"`. Verify first whether they already have it.

### 23. Performance baseline
- Record transform time for a 100-word and a 5,000-word input in each style.
- Record the size of each page. Add a size budget check to `npm test` that fails if a page grows past the current size plus a margin.

### 24. Edge cases for quote card and transform
- Inputs to test: empty string, whitespace only, a single emoji, RTL text, a 10,000-character paste, numbers, punctuation only, and text with stage-direction brackets already in it.
- Expected behavior should be written down and tested.

### 25. Localization readiness (optional)
- Move UI strings (button labels, placeholders, status messages) into one object per page. Keep transformation output English-only.
- Do this only after P0 and P1 are done.

### 26. Offline behavior
- Verify what the page looks like with Google Fonts blocked. Add a screenshot to the README.
- Decide whether a visible offline note is needed.

---

## Suggested order for OpenCode

1. Items 1–6 (docs accuracy). Small, safe, and they remove false claims.
2. Items 7–8 (seeded engine). Needed by several later tests.
3. Items 9–15 (tests for claims).
4. Items 16–18 (word list and policy docs, overlap check).
5. Items 19–26 (developer experience, accessibility, performance, optional localization).

## Acceptance criteria for the whole list

- `npm test` passes on a clean clone.
- Every README claim is either backed by a test or reworded to match what is tested.
- Every README example is produced by the engine under a fixed seed.
- No shipped page gains a runtime dependency.
