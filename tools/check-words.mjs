// Check one candidate word or line against the same content policy the suite
// enforces, without running the whole suite.
//
//   npm run check-words -- "some candidate line"
//   npm run check-words -- --roast "a candidate roast"
//   echo "text" | node tools/check-words.mjs
//
// Exits 1 on a policy hit, 2 on bad usage. Reviewed exceptions are reported as
// allowed and do not fail, matching tools/test-content.mjs.

import { readFileSync } from 'node:fs';
import {
  PROFANITY, EXPLICIT, SLURS, SERVITUDE, scanTerms, allowedMatches, hasEmoji,
} from './content-policy.mjs';

const args = process.argv.slice(2);
let roast = false;
let help = false;
const words = [];

for (const arg of args) {
  if (arg === '--roast') roast = true;
  else if (arg === '--help' || arg === '-h') help = true;
  else if (arg.startsWith('--')) {
    console.error(`unknown option: ${arg}`);
    process.exit(2);
  } else words.push(arg);
}

if (help) {
  console.log('usage: check-words [--roast] "word or line"\n'
    + '       check-words [--roast] < file');
  process.exit(0);
}

let text = words.join(' ').trim();
if (!text) {
  // Piped input; on an interactive terminal readFileSync(0) would block, so
  // only read when stdin is not a TTY.
  if (process.stdin.isTTY) {
    console.error('usage: check-words [--roast] "word or line"');
    process.exit(2);
  }
  text = readFileSync(0, 'utf8').trim();
}

if (!text) {
  console.error('nothing to check');
  process.exit(2);
}

const allowed = allowedMatches(text);
const checks = [
  ['profanity', PROFANITY],
  ['explicit', EXPLICIT],
  ['slur', SLURS],
];
if (roast) checks.push(['servitude (roast)', SERVITUDE]);

let failures = 0;
for (const [label, terms] of checks) {
  for (const term of scanTerms(text, terms)) {
    const exemption = allowed.find(([re]) => re.test(text));
    if (exemption) {
      console.log(`ok    ${label} "${term}" is covered by a reviewed exception:`);
      console.log(`      ${exemption[1]}`);
    } else {
      console.log(`FAIL  ${label} term "${term}"`);
      failures++;
    }
  }
}

if (hasEmoji(text)) {
  console.log('FAIL  literal emoji (use an HTML entity in UI text)');
  failures++;
}

if (failures) {
  console.log(`\n${failures} content-policy hit(s)`);
  process.exit(1);
}
console.log('\nno content-policy hits');
