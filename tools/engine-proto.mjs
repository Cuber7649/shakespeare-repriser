// Prototype of the single-pass longest-match replacement engine, kept out of the
// pages until it is validated. Mirrors what will be pasted into each page.

const WORD = /[A-Za-z0-9_]/;
const TOKEN = /[A-Za-z0-9_'’-]/;
const PURE_LITERAL = /^\\b([A-Za-z0-9_'’ \t-]+)\\b$/;

export function buildIndex(dicts) {
  const buckets = new Map();
  const fallbacks = [];
  let rank = 0;

  for (const dict of dicts) {
    const pairs = Array.isArray(dict) ? dict : Object.entries(dict);
    for (const [pat, rep] of pairs) {
      if (typeof pat === 'string') {
        addLiteral(buckets, pat, rep, rank++);
        continue;
      }
      const m = PURE_LITERAL.exec(pat.source);
      if (m) {
        addLiteral(buckets, m[1], rep, rank++);
      } else {
        fallbacks.push({
          re: new RegExp(pat.source, pat.flags.replace(/[gy]/g, '') + 'y'),
          rep,
          rank: rank++,
        });
      }
    }
  }

  for (const arr of buckets.values()) {
    arr.sort((a, b) => b.lower.length - a.lower.length);
  }
  return { buckets, fallbacks };
}

function addLiteral(buckets, phrase, rep, rank) {
  const lower = phrase.toLowerCase();
  const key = lower.split(/[ \t]/)[0];
  if (!buckets.has(key)) buckets.set(key, []);
  buckets.get(key).push({ lower, rep, rank });
}

export function makeReplacer(dicts) {
  const idx = buildIndex(dicts);

  return function replaceAll(text) {
    const lower = text.toLowerCase();
    const n = text.length;
    let out = '';
    let i = 0;

    while (i < n) {
      let j = i;
      while (j < n && TOKEN.test(text[j])) j++;
      if (j === i) {
        out += text[i];
        i++;
        continue;
      }

      let best = null;
      const bucket = idx.buckets.get(lower.slice(i, j));
      if (bucket) {
        for (const rule of bucket) {
          const end = i + rule.lower.length;
          if (end > n || !lower.startsWith(rule.lower, i)) continue;
          if (i > 0 && WORD.test(text[i - 1])) continue;
          if (end < n && WORD.test(text[end])) continue;
          if (!best || rule.lower.length > best.len) {
            best = { len: rule.lower.length, rep: rule.rep };
          }
        }
      }

      if (!best) {
        for (const fb of idx.fallbacks) {
          fb.re.lastIndex = i;
          const hit = fb.re.exec(text);
          if (hit && hit[0].length > 0 && (!best || hit[0].length > best.len)) {
            best = { len: hit[0].length, rep: fb.rep };
          }
        }
      }

      if (best) {
        out += best.rep;
        i += best.len;
      } else {
        out += text.slice(i, j);
        i = j;
      }
    }
    return out;
  };
}

// The engine as the page currently implements it, for side-by-side comparison.
export function oldChain(dicts) {
  return function applyOld(text) {
    let s = text;
    for (const dict of dicts) {
      const pairs = Array.isArray(dict) ? dict : Object.entries(dict);
      for (const [pat, rep] of pairs) {
        if (typeof pat === 'string') {
          s = s.replace(
            new RegExp('\\b' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'),
            rep
          );
        } else {
          s = s.replace(pat, rep);
        }
      }
    }
    return s;
  };
}

export const CHAIN_NAMES = [
  'sentenceTransforms', 'contractions', 'negatives', 'pronouns',
  'verbForms', 'commonWords', 'verbs', 'adjectives', 'nouns',
];
