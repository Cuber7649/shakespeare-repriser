# Todo

Quick fixes first, then CI, then features.

## CI and browser coverage

- [ ] **GitHub Actions workflow.** Run `npm test` on push and PR, on ubuntu
  and windows, Node 18 and 24. Zero dependencies, so the runner just needs
  Node. Windows runners have Edge, so browser journeys run for real there.

- [ ] **Linux and macOS browser candidates.** `EDGE_CANDIDATES` in
  `browser-journeys.mjs` lists only Windows paths. Add `/usr/bin/microsoft-edge`,
  `/usr/bin/google-chrome`, and the macOS app paths so journeys also run on
  ubuntu CI. The spawn flags are plain Chromium already.

- [ ] **Firefox and Safari coverage (stretch).** README admits the gap. Real
  coverage likely needs a test-only dependency, which bends the zero-dep rule.
  Decide if a separate CI job may carry one.

## Features

- [ ] **Offline service worker.** The app installs but needs network to load.
  Add a small `sw.js` with a versioned cache, registered only on https.
  `file://` pages stay untouched. Bump the cache version on deploy and extend
  the suite.

- [ ] **Shareable links.** Encode text, style, settings, and seed in the URL
  hash behind a Copy Link button. Cap the length. The hash never leaves the
  browser, so the privacy story holds.

## Chores

- [ ] **Recompress `Screenshot.png`.** 912 KB, the repo's biggest file.
  Lossless recompress, done deliberately outside the suite since the file is
  hand-maintained.

## Decisions

- [ ] **Rule on "ye cross-eyed bilge monkey".** Open call from AGENTS.md. It
  sits in `ALLOWED` with a standing WARN. If it goes, remove the line and the
  `ALLOWED` entry together.

- [ ] **Optional: one style registry under `tools/`.** Adding a style touches
  about 15 files. A shared `styles.mjs` for generators and tests would cut
  that to one edit. Build-time only, so standalone pages stay intact. The
  docs call the repetition deliberate, so this is an owner call.
