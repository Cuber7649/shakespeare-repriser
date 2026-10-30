// Shared content-policy vocabulary. tools/test-content.mjs enforces it over the
// shipped quotes and roasts; tools/check-words.mjs uses the same lists so a
// candidate can be checked without running the whole suite.
//
// Matching is always on word boundaries. Substring matching produced the
// historical false positives this list is designed to avoid: "arse" inside
// "coarser", "prick" inside "the pricking of my thumbs".

export const PROFANITY = [
  'fuck', 'fucking', 'shit', 'bullshit', 'piss', 'pissed', 'wank', 'bollocks',
  'bugger', 'bastard', 'twat', 'wanker', 'cunt', 'arsehole', 'arse', 'dickhead',
];

export const EXPLICIT = [
  'sex', 'sexual', 'sexy', 'naked', 'nude', 'nudity', 'erection', 'penis',
  'vagina', 'boobs', 'breasts', 'orgasm', 'porn', 'prostitute', 'whore',
  'slut', 'bitch', 'rape', 'raped', 'molest', 'incest', 'paedophile', 'pedophile',
];

// Kept deliberately short and specific: these are slurs, not a thesaurus of
// historical English. Generic insults like "fool" or "coward" are the point of
// the roasts and are not family-unfriendly.
export const SLURS = [
  'nigger', 'nigga', 'faggot', 'faggots', 'kike', 'spic', 'chink', 'wetback',
  'tranny', 'retard', 'retarded', 'paki', 'coon', 'gook', 'raghead', 'towelhead',
  'shemale', 'dyke', 'jap',
];

// Servitude is checked against roasts only, never quotes: two pirate quotes
// argue against slavery and must stay.
export const SERVITUDE = [
  'slave', 'slaves', 'thrall', 'thralls', 'serf', 'bondswoman', 'bondman',
];

// Reviewed exceptions, each with the reason it is allowed. Anything listed here
// should be re-read if the corpus changes. These are documentation and a warning
// source, not a bypass: the term lists above are already narrow enough that the
// canonical Shakespeare lines do not hit them once matching respects word
// boundaries.
export const ALLOWED = [
  [/Out, damned spot!/i,
    'canonical Macbeth; "damned" means condemned here, not the oath "damn"'],
  [/pricking of my thumbs/i, 'canonical Macbeth, non-sexual sense of "prick"'],
  [/If you prick us/i, 'canonical Merchant of Venice, non-sexual sense of "prick"'],
  [/coarser than a toad/i, 'a Shakespeare line; "arse" appears inside "coarser"'],
  [/bilge monkey/i,
    'Golden Age nautical ribaldry, no slur implication -- FLAGGED FOR REVIEW, see report'],
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Return the terms from `terms` that appear in `text` on word boundaries. */
export function scanTerms(text, terms) {
  const hits = [];
  const lower = String(text).toLowerCase();
  for (const term of terms) {
    if (new RegExp(`\\b${escapeRe(term)}\\b`, 'i').test(lower)) hits.push(term);
  }
  return hits;
}

/** Return the ALLOWED entries whose pattern matches `text`. */
export function allowedMatches(text) {
  return ALLOWED.filter(([re]) => re.test(text));
}

// Literal emoji are banned in the UI; HTML entities are the supported form.
// This catches the ranges people actually paste, not every pictograph.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

export function hasEmoji(text) {
  return EMOJI.test(String(text));
}
