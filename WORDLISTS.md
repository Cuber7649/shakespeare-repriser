# Word lists

Each style page owns its entire vocabulary. There is no shared word data: the
six `.html` files are independent, and the dashboard is generated from them.
This file describes the format and the rules for changing an entry.

## The tables

Each style page has the same set of tables, in the same order, between the
`// ===` banners above the replacement engine:

| Table | What it holds | Example |
| ----- | ------------- | ------- |
| `sentenceTransforms` | Whole phrases and idioms, matched longest-first | `[\bhow are you\b, "how dost thou fare"]` |
| `contractions` | Apostrophe forms | `[\byou're\b, "thou art"]` |
| `negatives` | Negated auxiliaries, keyed by the literal phrase | `"don't": "doth not"` |
| `pronouns` | `you`/`your`/`yours` and reflexives | `[/\byou\b/gi, "thou"]` |
| `verbForms` | `is`, `was`, `has`, `does`, `can`, `will`, … | `[/\bwas\b/gi, "wast"]` |
| `commonWords` | Adverbs, quantifiers, discourse words | `[/\bvery\b/gi, "exceedingly"]` |
| `verbs` | Ordinary verbs | `[/\bsee\b/gi, "behold"]` |
| `adjectives` | Adjectives | `[/\bhappy\b/gi, "merry"]` |
| `nouns` | Nouns | `[/\bfriend\b/gi, "good fellow"]` |

Decorative pools sit beside them and are not part of the replacement pass:
`openings`, `midInsertions`, `quotes`, `metaphors`, `insults`, `asides`,
`stageDirections`, `alliterations`, and the `inversions` patterns. Grammar
repairs use two per-page configs: `pronounCase` (`thou`/`thee`, or `null`) and
`agreement` (subject-sensitive verb fixes, or `null`).

## Format

Most entries are `[regex, "replacement"]` pairs. The engine treats a pattern as
a **literal phrase** when its source is only `\b`, letters, digits, apostrophes,
spaces, tabs and hyphens inside a single pair of `\b` anchors. Those entries are
indexed by their first word and matched longest-first. Anything else — a
character class, an alternation, a capture group — is kept as an anchored
regex fallback and tried at every position.

`negatives` is a plain object because it is keyed by the literal phrase; the
engine turns it into the same literal rules as everything else.

The replacement pass is **single-pass, left to right, longest match wins**.
Replacement text is never rescanned, so a rule cannot cascade into another rule.
On equal length, the earlier table wins, and within a table the earlier entry
wins; this is why reordering entries changes seeded output.

## Adding or changing an entry

1. Edit the table in the style page (or pages) that need it. If the same word
   should change in every style, edit each page — there is no shared source for
   vocabulary.
2. Keep the family-friendly rules in [`CONTENT_POLICY.md`](./CONTENT_POLICY.md)
   and the voice rules in [`AGENTS.md`](./AGENTS.md).
3. Record a snapshot before and after, and read the diff:

   ```bash
   node tools/snapshot.mjs before.json     # before the edit
   # ... edit ...
   node tools/snapshot.mjs after.json
   node tools/compare.mjs before.json after.json
   ```

4. Run `npm test`. `test-grammar.mjs` catches the shapes the flat tables get
   wrong; `test-content.mjs` catches content-policy violations; `check-readme`
   re-checks the examples.

Removing or reordering an entry shifts every seeded output downstream because
`pick()` is index-based. That is expected. Judge the comparison by whether the
blast radius is proportionate to the edit, not by whether anything moved.

## Traps

- **Word boundaries.** Every regex needs them. Historical false positives came
  from `arse` inside "coarser", `prick` inside "pricking", and `slave` inside
  anti-slavery quotes.
- **The replacement must not contain a match key** unless you intend the
  single-pass guarantee to hide it. `audit-cascades.mjs` reports these.
- **Duplicates across tables.** A word in both `commonWords` and `verbs` is
  matched by whichever table the engine indexes first (and by length). Run
  `audit-rules.mjs` to see conflicts.
- **No unseeded randomness.** Any new random choice must use `rand()`/`pick()`,
  never `Math.random()`, or the whole regression suite is void.
- **No emoji in displayed text.** Use HTML entities in markup if a pictogram is
  needed.
