// Pre-push audit: confirm the working tree is the tested, expected state.
import { readFileSync, readdirSync } from 'node:fs';

let bad = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const no = (m) => { console.log(`  BAD   ${m}`); bad++; };

const PAGES = ['index.html', 'shakespeare.html', 'pirate.html', 'victorian.html',
  'chaucer.html', 'yoda.html', 'norse.html'];
const html = {};
for (const f of PAGES) html[f] = readFileSync(f, 'utf8');
const idx = html['index.html'];

// --- the dashboard must use the shared modal, not its own copy -------------
idx.includes('function initCardUI') ? ok('index.html inlines the shared initCardUI')
  : no('index.html has no initCardUI');
/function openCard\(styleId/.test(idx) ? no('index.html still has the old inline openCard')
  : ok('index.html no longer duplicates the modal wiring');
(idx.match(/id="cardModal"/g) || []).length === 1
  ? ok('exactly one #cardModal in index.html') : no('duplicate #cardModal');
(idx.match(/id="cardStatus"/g) || []).length === 1
  ? ok('exactly one #cardStatus in index.html') : no('duplicate #cardStatus');

// --- Make Card: one button per style page, six on the dashboard ------------
for (const f of PAGES.slice(1)) {
  const t = html[f];
  (t.match(/id="makeCardBtn"/g) || []).length === 1
    ? ok(`${f} has one Make Card button`) : no(`${f} Make Card button count is wrong`);
  (t.match(/data-card="/g) || []).length === 1
    ? ok(`${f} points Make Card at its own style`) : no(`${f} data-card count is wrong`);
}
(idx.match(/data-card="/g) || []).length === 6
  ? ok('index.html offers Make Card for all six styles') : no('index.html data-card count is wrong');

// --- removed pages must stay gone ------------------------------------------
const gone = ['unscramble.html', 'random.html', 'compliments.js'];
const stillLinked = gone.find((g) => PAGES.some((f) => html[f].includes(g)));
stillLinked ? no(`a page still references ${stillLinked}`) : ok('no references to removed pages');

// --- removed content must really be gone everywhere ------------------------
for (const where of ['norse.html', 'index.html']) {
  /\b(thrall|slave)\b/i.test(html[where].match(/const insults = \[[\s\S]*?\]/)?.[0] || '')
    ? no(`${where} still has a servitude insult`) : ok(`${where} roast list is servitude-free`);
}
// The two near-duplicate Yoda quotes.
for (const dup of ['Do, or do not. There is no try.', 'The Force will be with you, always.']) {
  const hit = ['yoda.html', 'index.html'].find((f) => html[f].includes(dup));
  hit ? no(`${hit} still has duplicate: ${dup}`) : ok(`removed duplicate: "${dup.slice(0, 34)}..."`);
}

// --- nothing that looks like a secret --------------------------------------
// Match on high-entropy credential *shapes* and assignments, not the bare words.
// A naive /secret|token/i scan is useless here: this repo is full of 19th-century
// word lists, so it hit the dictionary rule secret->"mystery", the tokenizer's
// _TOKEN_CHAR regex, and the Chaucer phrase "with token and tryste".
const SECRET = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,            // GitHub tokens
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,          // Slack
  /\bsk-[A-Za-z0-9]{20,}/,                   // OpenAI-style keys
  /\bAKIA[0-9A-Z]{16}\b/,                    // AWS access key id
  /\bAIza[0-9A-Za-z_-]{35}\b/,               // Google API key
  /(?:api[_-]?key|secret|password|passwd|auth[_-]?token)\s*[:=]\s*['"][^'"\s]{12,}/i,
];
// --- no local machine paths leaking into the shipped files -----------------
const LOCAL = /C:[\\/]Users[\\/]|file:\/\/\/[A-Za-z]:|AppData[\\/]|[A-Za-z]:[\\/]Users[\\/]/;
const toolFiles = readdirSync('tools')
  .filter((f) => /\.(mjs|js|css|html)$/.test(f))
  .map((f) => `tools/${f}`);
const scan = [...PAGES, ...toolFiles];
const secretHits = scan.filter((name) => SECRET.find((re) => re.test(readFileSync(name, 'utf8'))));
const localHits = scan.filter((name) => LOCAL.test(readFileSync(name, 'utf8')));
secretHits.length === 0
  ? ok(`no secrets in ${scan.length} scanned files`) : secretHits.forEach((n) => no(`${n} looks like it contains a secret`));
localHits.length === 0
  ? ok('no local machine paths in shipped files') : localHits.forEach((n) => no(`${n} contains a local machine path`));

// --- no leftover scratch files ---------------------------------------------
const strays = readdirSync('.').filter((f) => /\.(before|after|tmp|bak|orig)$|^(before|after)-/.test(f));
strays.length === 0 ? ok('no scratch files in the repo root') : no(`stray files: ${strays.join(', ')}`);

// --- the test gate must be in the repo --------------------------------------
readdirSync('.').includes('tools') && readdirSync('.').includes('package.json')
  ? ok('tools/ and package.json present (npm test is the gate)')
  : no('tools/ or package.json missing from the repo root');

console.log('');
console.log(bad ? `${bad} problem(s) -- NOT ready to push` : 'working tree is ready to push');
process.exit(bad ? 1 : 0);
