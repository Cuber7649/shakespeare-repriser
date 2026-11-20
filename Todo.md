# Todo

Features, then chores and owner decisions.

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
