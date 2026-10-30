# Accessibility

The target is **WCAG 2.1 AA in intent**. This is not a conformance claim: the
automated checks below cover markup and keyboard journeys, but no screen-reader
or full WCAG audit has been run.

## What is checked automatically

`tools/check-a11y.mjs` audits all seven shipped pages for:

- a language declaration and a viewport meta tag
- exactly one `h1`
- a label or accessible name for every form control
- every `label[for]` pointing at a real control
- a non-empty accessible name for every button
- dialog semantics (`role="dialog"`, `aria-modal`, real `aria-labelledby` /
  `aria-controls` targets)
- a live status region
- `alt` text on images
- a `:focus-visible` style
- a `prefers-reduced-motion: reduce` block
- `aria-hidden="true"` on decorative icon-only spans

`tools/browser-journeys.mjs` checks in real headless Edge:

- Tab reaches the input and the Transform button; Enter transforms
- the quote-card modal opens by keyboard, traps Tab focus and closes on Escape
- no horizontal overflow at 360 px and 1280 px
- the page still transforms with the Google Fonts CDN blocked

`tools/check-css.mjs` checks stylesheet balance and the reduced-motion block.

## Known gaps

- **No axe-core or equivalent.** Adding it would introduce a dev dependency;
  the project ships with none. A one-off audit in a browser's accessibility
  tools is welcome, but not part of `npm test`.
- **No screen-reader run.** Names, roles and live regions are checked
  statically; actual announcements (especially the six dashboard outputs) have
  not been listened to.
- **Contrast is not measured.** The parchment palette is chosen by eye. The
  muted gold text on cream is the likeliest weak point.
- **Zoom and reflow are not tested** beyond the two viewport widths. The
  browser journey checks sideways overflow, not text spacing at 200% zoom.
- **Focus order is only covered on the main journey**, not every control.
- **Dynamic output on the dashboard** has one status message rather than one
  live region per style; announcing six results individually would be noisy.

## Conventions

- Icon-only spans use numeric HTML entities and carry `aria-hidden="true"`; the
  adjacent visible text carries the name.
- No literal emoji in UI text. `tools/check-words.mjs` flags them in content.
- Status changes go through an existing `role="status"` region.
- New controls need a `<label for>` (or `aria-label`), and `check-a11y.mjs`
  fails without one.

If you change the palette, check contrast before committing. If you add a
dialog or a new live region, extend `check-a11y.mjs` so the next change cannot
silently remove the semantics.
