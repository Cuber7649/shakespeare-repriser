# Improvement plan

Snapshot from a full review on 2026-10-20. Baseline: `npm test` green (26/26
steps), all six styles sampled through `tools/harness.mjs` at a fixed seed.

**Rating: 7.5/10** — engineering 9, docs/process 9, output quality 6.5,
utility/ambition 7.

The gap is narrow and specific: the build and test machinery is stronger than
most commercial repos, but the rewrites still emit visibly ungrammatical
sentences. The suite checks determinism and coverage, not grammar, so these
defects pass CI.

## What is already strong (do not regress)

- Six standalone pages, zero dependencies, offline/PWA, no user-facing build.
- Dashboard is generated from the pages and verified by `verify-dashboard.mjs`.
- Shared blocks are single-sourced under `tools/` and byte-checked by
  `paste-shared.mjs --check`.
- Content, a11y, CSS, links, README examples and README claims are all
  test-enforced. Determinism is enforced.
- `AGENTS.md` records invariants and judgment calls with reasons.

## Defects observed

Five inputs, one fixed seed, all six styles. Representative failures:

| Defect | Example | Likely cause |
| --- | --- | --- |
| Object pronoun gets subject form | `behold thou`, `I adore thou`, `to seen thou`, `I loven thou` | `pronouns` maps every `you` to `thou` with no case awareness |
| Filler wedged mid-phrase | `how dost by my troth thou fare`, `A most fair by my troth morrow` | `maybeAddFiller` splices at a random word index ≤ 3 |
| Inversion crosses clause boundaries | `and will we complete the voyage it`, `and will we complete it` | `inversions` regexes are sentence-global, not clause-scoped |
| Person agreement ignored | `I doth not` | `negatives["don't"] = "doth not"` and `does → doth` ignore the subject |
| Stacked inserts, bad punctuation | `By my troth Good sooth!`, `Most certainly Good gracious!` | several insertion helpers can fire in one sentence; no shared budget or re-punctuation |
| Doubled intensifiers | `exceedingly most agreeable`, `most certainly most arduous` | `very → exceedingly` plus a separate intensity insert |
| Yoda near no-op | 2 of 5 samples unchanged, 2 more changed by a single word | recent commits prioritised accuracy over reordering |

## Priority order

### 1. Pronoun case (highest visible payoff)

`pronouns` in each page currently does a flat `you → thou`. Add a case pass
after substitution:

- Subject position: before a finite verb (`thou art`, `thou dost`) → `thou`.
- Object of a verb or preposition (`to`, `for`, `with`, `behold`, `love`,
  `see`, `help`, `thank`, `tell`, `give`, `show`, `bring`, `find`, `let`) →
  `thee`.
- Possessive stays `thy` / `thine` by the existing rule.

A short verb/preposition list plus a lookbehind is enough; a full parser is
not. Keep the pass deterministic and keep the replacement engine single-pass.

Target behaviour to lock in:

```text
I love you            -> ... love thee
help me with you      -> ... with thee
you are brave         -> thou art brave
you help me           -> thou helpest me
```

### 2. Filler placement and sentence budget

`maybeAddFiller` (`shakespeare.html`, around line 2109) picks `idx` in the
first three words and inserts after it. Replace the random splice with clause
boundaries only:

- Prefer a sentence-initial interjection plus comma: `By my troth, ...`
- Otherwise insert only immediately after a comma or a completed clause.
- Never insert between an article/adjective and its noun, or between an
  auxiliary and its verb.
- Enforce **one** insertion per sentence across `openings`, `midInsertions`,
  fillers, asides, quotes, metaphors and insults. Pick one, do not stack.
- Re-capitalise after `!` / `?` and add the missing comma; never produce
  `By my troth Good sooth!`.

### 3. Clause-scoped inversion

`maybeInvert` runs `inversions` over the whole sentence. Split the sentence
at `,` / `and` / `but` / `because` / `although` first, invert at most the main
clause, and never invert a clause introduced by a subordinator. Also skip
inversion when it would move an auxiliary away from its object
(`complete the voyage it`).

### 4. Person-aware negation and auxiliaries

Replace the flat map with subject-sensitive forms:

| Input | Output |
| --- | --- |
| I don't | I do not |
| you don't | thou dost not |
| he doesn't | he doth not |
| we don't | we do not |
| I am not | I am not |
| you aren't | thou art not |

Same treatment for `have/has`, `was/were`, `will/would`. Keep the existing
contraction table for the rest.

### 5. One intensity word per phrase

Dedupe within a small window: if a phrase already contains `most`,
`exceedingly`, `very`, `right`, `most certainly`, do not add another. This
removes `exceedingly most` and `most certainly most` without touching the
dictionary.

### 6. Decide Yoda's contract

Two acceptable outcomes, but pick one and document it:

- **Light touch:** state in README that Yoda preserves ordinary prose and
  only reorders clear subject–verb–object clauses.
- **Stronger reordering:** extend object fronting to transitive clauses and
  add a Yoda corpus of expected outputs so both regressions and overreach are
  caught.

Do not silently tighten it: the last six commits were about accuracy and
holdout misreadings. Read that history before changing the parser.

## Tests to add

Add `tools/test-grammar.mjs` and wire it into `tools/run-all.mjs`. It should
reuse `tools/corpus.mjs`, `tools/harness.mjs` and the existing `SEEDS`, then
fail on banned patterns rather than exact strings. Exact strings are brittle
because `pick` is index-based and word-list edits shift everything.

Banned patterns, applied to every style across the corpus and seeds:

```js
/\b(?:behold|love|adore|see|help|thank|tell|give|show|bring)\s+thou\b/
/\bI doth\b/
/\b(?:we|they|you)\s+(?:will|can|should|would)\s+(?:we|they|you)\b/
/\b(?:by my troth|forsooth|verily|marry)\s+[A-Z]/
/\b(?:most|exceedingly|very)\s+(?:most|exceedingly|very)\b/
/thou\s+(?:is|are|was|were)\b/
```

For inversion, a regex is too blunt: split each sentence at
`and|but|because|although|while`, then flag any clause after the first that
starts with an auxiliary followed by a subject (`and will we`, `but can he`).
That is the exact shape of the observed defect and it cannot be produced by
legitimate fronting in this engine.

Also assert one-insertion-per-sentence structurally: expose a debug counter
or check that no output contains two entries from the interjection list.

Workflow for any wording change:

```bash
node tools/snapshot.mjs before.json
# edit tools/ sources, then:
node tools/paste-shared.mjs
npm test
node tools/snapshot.mjs after.json
node tools/compare.mjs before.json after.json
```

Removing or reordering word-list entries shifts every seeded output. That is
expected; judge the diff by whether the shift is proportionate to the edit.

## Guardrails

- Edit `tools/` sources, never pasted copies or `index.html`.
- Engine changes live in all six style pages; `build-dashboard.mjs` extracts
  the block verbatim, so a one-page edit will fail `test-engine.mjs` or
  produce a drifting dashboard.
- Preserve determinism: no `Math.random()`, only `rand()`.
- Do not undo the content judgment calls in `AGENTS.md` (slavery ban scoped to
  roasts, kept drunkenness/filth/oath-breaker roasts, `bilge monkey` warning).
- No emoji in UI. Family-friendly still applies.
- Commit only when the owner asks. Run `node tools/prepush-check.mjs` after
  committing, before any push.

## Acceptance criteria for a 9/10 pass

1. `npm test` green, including the new grammar step.
2. Zero hits for the banned patterns across 6 styles × full corpus × all
   seeds.
3. No output stacks two interjections or inserts a filler inside a noun
   phrase.
4. Inversion never crosses a coordinating or subordinating conjunction.
5. Pronoun objects use `thee` / `you`; subject positions use `thou`.
6. Yoda's contract is stated in README and covered by tests.
7. `node tools/compare.mjs` shows no unintended blast radius beyond the
   targeted rules.

Engineering and process are already at 9. The remaining point is almost
entirely linguistic fidelity, and most of it sits in two functions
(`maybeAddFiller`, `inversions`) and three tables (`pronouns`, `negatives`,
`verbForms`).

## Reproduce the review sample

The harness import needs a `file://` URL on Windows. Example scratch script
(keep it outside the repo):

```js
import { loadPage } from 'file:///C:/Users/blink/Documents/Development/shakespeare-repriser/tools/harness.mjs';

const pages = [
  ['shakespeare.html', 'shakespearify'],
  ['pirate.html', 'pirateify'],
  ['victorian.html', 'victorianify'],
  ['chaucer.html', 'chaucerify'],
  ['yoda.html', 'yodaify'],
  ['norse.html', 'norseify'],
];

const inputs = [
  'Hello, how are you today? I am very happy to see you.',
  "I don't want to go to the store because it is raining.",
  'This project is difficult, but the team is smart and we will finish it.',
  'Good morning! Can you help me with my computer?',
  'I love you. You are my best friend, and I will never forget this day.',
];

for (const [file, entry] of pages) {
  const page = loadPage('C:/Users/blink/Documents/Development/shakespeare-repriser/' + file, entry);
  console.log('=== ' + file + ' ===');
  for (const input of inputs) console.log(page.transform(input, 7));
}
```
