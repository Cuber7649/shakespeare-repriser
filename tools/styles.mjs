// Canonical style registry. Adding a style should be a single edit here:
// generators and tests derive their lists from these exports instead of
// repeating six-entry arrays. Standalone pages still ship verbatim shared
// blocks; those have their own paste gates (see tools/quotecard.js theme table
// and tools/paste-shared.mjs).
//
// `entry` cannot be derived from `id` (Shakespeare is `shakespearify`), and
// Yoda needs two extra helpers in the generated dashboard module.

export const STYLES = [
  {
    id: 'shakespeare', label: 'Shakespeare', file: 'shakespeare.html',
    href: 'shakespeare.html', entry: 'shakespearify', icon: '&#128220;',
    theme: { from: '#faf3e6', mid: '#f0e4cc', to: '#e8d9b8' },
  },
  {
    id: 'pirate', label: 'Pirate', file: 'pirate.html',
    href: 'pirate.html', entry: 'pirateify', icon: '&#9875;',
    theme: { from: '#e8f0e6', mid: '#d8e8d4', to: '#c8dcc2' },
  },
  {
    id: 'victorian', label: 'Victorian', file: 'victorian.html',
    href: 'victorian.html', entry: 'victorianify', icon: '&#128187;',
    theme: { from: '#f4eef8', mid: '#e8e0f0', to: '#dcd2e8' },
  },
  {
    id: 'chaucer', label: 'Chaucer', file: 'chaucer.html',
    href: 'chaucer.html', entry: 'chaucerify', icon: '&#128220;',
    theme: { from: '#f8f2e0', mid: '#f0e8d0', to: '#e8dec0' },
  },
  {
    id: 'yoda', label: 'Yoda', file: 'yoda.html',
    href: 'yoda.html', entry: 'yodaify', icon: '&#128161;',
    extraHelpers: ['frontObject', 'frontInfinitive'],
    theme: { from: '#e8f4e6', mid: '#d8ecd2', to: '#c8e2c2' },
  },
  {
    id: 'norse', label: 'Norse', file: 'norse.html',
    href: 'norse.html', entry: 'norseify', icon: '&#9876;',
    theme: { from: '#f0eaf8', mid: '#e4dcf0', to: '#d8d0e8' },
  },
];

export const DASHBOARD = 'index.html';
export const STYLE_IDS = STYLES.map((s) => s.id);
export const STYLE_FILES = STYLES.map((s) => s.href);

// Dashboard first (prepush-check), or last (the paste/test helpers).
export const ALL_PAGES = [DASHBOARD, ...STYLE_FILES];
export const PAGES_WITH_DASHBOARD = [...STYLE_FILES, DASHBOARD];

// Derived shapes matching the historical literals in tools/, so a consumer
// only changes its import line.
export const BY_ID = Object.fromEntries(
  STYLES.map((s) => [s.id, [s.href, s.entry]]));
export const BY_FILE = Object.fromEntries(
  STYLES.map((s) => [s.href, s.id]));
export const FILE_ENTRY = STYLES.map((s) => ({ file: s.href, entry: s.entry }));
export const ID_FILE_ENTRY = STYLES.map((s) => ({
  id: s.id, file: s.href, entry: s.entry,
}));
export const FILE_ENTRY_TUPLES = STYLES.map((s) => [s.href, s.entry]);
export const ID_FILE_TUPLES = STYLES.map((s) => [s.id, s.href]);
export const ID_FILE_ENTRY_TUPLES = STYLES.map((s) => [s.id, s.href, s.entry]);
