# Content policy

The apps rewrite whatever the visitor types; they do not moderate input. This
policy governs the **authored** content that ships with them: the quotes and
roasts in each style page, and the decorative pools the engine inserts.

## What "family-friendly" means here

- No profanity, no sexual or explicit material, no slurs.
- Playful insults are allowed and are part of the voice: "thou knave",
  "bilge rat", "you scurvy dog". The target is conduct or character, never an
  identity.
- Historical language is allowed when it is the point of the style. Chaucer,
  Shakespeare and the Norse pages are deliberately archaic; sanitising them
  into modern blandness would be its own kind of disrespect.
- Slavery and servitude are never the punchline of a roast. Quotations that
  argue **against** slavery are allowed and two pirate lines do exactly that.

## Where it is enforced

`tools/test-content.mjs` scans every quote and roast in all six style pages:

- `PROFANITY` — common English profanity.
- `EXPLICIT` — sexual and explicit terms.
- `SLURS` — a short, specific list of identity slurs, not a thesaurus of
  historical insults.
- `SERVITUDE` — checked against roasts only, so anti-slavery quotes survive.

Matching is on **word boundaries**. That detail matters: naive substring
matching once flagged `arse` inside "coarser", `prick` inside "the pricking of
my thumbs", and `slave` inside the anti-slavery quotations.

The term lists live in `tools/content-policy.mjs`; the test and
`npm run check-words` both read them, so the two cannot disagree.

## Exceptions

Reviewed exceptions live in the `ALLOWED` list in `tools/test-content.mjs`.
Each entry is a specific regex plus a written reason. The list is a record of
judgement calls, not a bypass: if the corpus changes, re-read the entries.

To request an exception:

1. Run `npm run check-words -- "the line"` (add `--roast` for a roast).
2. If the hit is a legitimate historical or canonical usage, add a narrow
   regex to `ALLOWED` with a reason that explains the sense, not just "it is
   fine".
3. If the line is genuinely family-unfriendly, rewrite or remove the line. Do
   not weaken the blocklist to make one line pass.

## Settled judgement calls

Do not "helpfully" undo these without the owner:

- Four Norse roasts that used `thrall`/`slave` were reworded to attack conduct
  instead ("withered old fool", "craven liar", …). The ban stays scoped to
  roasts because two pirate quotes argue against slavery and must remain.
- Drunkenness, filth and oath-breaker roasts were kept. Drunkenness and disease
  imagery are in scripture; attacking liars and traitors is pro-virtue; and
  removing them would gut the Chaucer/Shakespeare/pirate voice.
- Shakespearean comic abuse ("thou knob of a dunghill") stays for the same
  reason.
- `"ye cross-eyed bilge monkey"` is allowed through `ALLOWED` and emits a
  standing `WARN`. It is Golden Age nautical ribaldry with no slur
  implication. The owner has not issued a final ruling; if you disagree,
  remove the line and the `ALLOWED` entry together.

## Checking a candidate

```bash
npm run check-words -- "some candidate line"
npm run check-words -- --roast "a candidate roast"
```

The script exits `1` on a policy hit, so it can be used in a pre-commit hook.
It also flags literal emoji, because the UI uses HTML entities rather than
emoji characters.
