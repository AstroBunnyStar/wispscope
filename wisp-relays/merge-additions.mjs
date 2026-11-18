// Folds wisp-relays/additions-*.json into the published dataset.
//
// Each additions file carries relays verified by a discovery pass, plus the
// Eaglercraft evidence for the independent ones. Keeping these in small files
// means a new relay costs a 2 KB commit instead of a 100 KB regenerated
// dataset, and CI materialises the dataset and the scanner from them.
//
// Derived state (independent list, verified pool, README counts) is reconciled
// on every run, so a dataset that changed by another route still gets its
// counts corrected.
//
// Idempotent: relay URLs, evidence rows and list entries already present are
// skipped, and README counts are only written when they differ.
//
// Usage: node wisp-relays/merge-additions.mjs

import fs from 'node:fs';
import path from 'node:path';

const DATA = 'wisp-relays/scanner-relays-454.json';
const COMPAT = 'wisp-relays/eagler-compat.json';
const TOTAL = 'wisp-relays/verified-total.txt';
const README = 'README.md';
const DIR = 'wisp-relays';

const key = (url) => String(url || '').replace(/\/$/, '');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const data = read(DATA);
const compat = read(COMPAT);
const urls = new Set(data.map((r) => key(r.url)));
const compatUrls = new Set(compat.map((r) => key(r.url)));

let nextIndep = Math.max(0, ...data.filter((r) => /^ind-\d+$/.test(r.id)).map((r) => Number(r.id.slice(4))));
let nextAlias = Math.max(0, ...data.filter((r) => /^alias-\d+$/.test(r.id)).map((r) => Number(r.id.slice(6))));

const indFiles = fs.readdirSync(DIR).filter((f) => /^independent-\d+\.txt$/.test(f));
const indFile = indFiles.sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).pop();
const independent = fs.readFileSync(path.join(DIR, indFile), 'utf8').split(/\r?\n/).filter(Boolean);
const indSet = new Set(independent.map(key));

const additions = fs.readdirSync(DIR).filter((f) => /^additions-.*\.json$/.test(f)).sort();
const newUrls = [];
let addedRelays = 0;
let addedEvidence = 0;

for (const file of additions) {
  const block = read(path.join(DIR, file));
  for (const relay of block.relays || []) {
    if (!relay.url || urls.has(key(relay.url))) continue;
    const group = relay.group === 'independent' ? 'independent' : 'alias';
    const id = group === 'independent'
      ? 'ind-' + String((nextIndep += 1)).padStart(2, '0')
      : 'alias-' + String((nextAlias += 1)).padStart(3, '0');
    data.push({ ...relay, id, group });
    urls.add(key(relay.url));
    newUrls.push(relay.url);
    addedRelays += 1;
    if (group === 'independent' && !indSet.has(key(relay.url))) {
      independent.push(relay.url);
      indSet.add(key(relay.url));
    }
  }
  for (const row of block.compat || []) {
    if (!row.url || compatUrls.has(key(row.url))) continue;
    compat.push(row);
    compatUrls.add(key(row.url));
    addedEvidence += 1;
  }
}

// --- verified pool -------------------------------------------------------
const verified = fs.readFileSync(TOTAL, 'utf8').split(/\r?\n/).filter(Boolean);
const verifiedSet = new Set(verified.map(key));
let poolAdded = 0;
for (const url of newUrls) {
  if (verifiedSet.has(key(url))) continue;
  verified.push(url);
  verifiedSet.add(key(url));
  poolAdded += 1;
}

// --- files ---------------------------------------------------------------
if (addedRelays || addedEvidence) {
  fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
  fs.writeFileSync(COMPAT, JSON.stringify(compat, null, 2) + '\n');
  // A new snapshot alongside the older ones: this repository keeps every
  // independent-<n>.txt as history rather than replacing the previous list.
  fs.writeFileSync(path.join(DIR, 'independent-' + independent.length + '.txt'), independent.join('\n') + '\n');
}
if (poolAdded) fs.writeFileSync(TOTAL, verified.join('\n') + '\n');

// --- README counts (always reconciled) -----------------------------------
const aliases = data.filter((r) => r.group === 'alias').length;
const offered = data.filter((r) => r.group === 'independent' && r.eagler === 'ok').length;
const before = fs.readFileSync(README, 'utf8');
const after = before
  .replace(/\*\*[\d,]+ relay URLs\*\*/, '**' + data.length + ' relay URLs**')
  .replace(/- \*\*[\d,]+ independent endpoints\*\* in `wisp-relays\/independent-[\d]+\.txt`/,
    '- **' + independent.length + ' independent endpoints** in `wisp-relays/independent-' + independent.length + '.txt`')
  .replace(/- \*\*[\d,]+ aliases\*\* in `wisp-relays\/scanner-relays-[\d]+\.json`/,
    '- **' + aliases + ' aliases** in `wisp-relays/' + path.basename(DATA) + '`')
  .replace(/- \*\*[\d,]+ verified URLs\*\* including the wider alias pool/,
    '- **' + verified.length.toLocaleString('en-US') + ' verified URLs** including the wider alias pool')
  .replace(/\*\*[\d]+ of the [\d]+\*\* independent endpoints also pass/,
    '**' + offered + ' of the ' + independent.length + '** independent endpoints also pass')
  // prose references to the independent list and its size
  .replace(/independent-\d+\.txt/g, 'independent-' + independent.length + '.txt')
  .replace(/choose any of the \d+ independent endpoints/, 'choose any of the ' + independent.length + ' independent endpoints');
if (after !== before) fs.writeFileSync(README, after);

console.log('added relays:   ' + addedRelays + (addedRelays || addedEvidence ? '' : ' (none pending)'));
console.log('added evidence: ' + addedEvidence);
console.log('verified pool:  ' + verified.length + (poolAdded ? ' (+' + poolAdded + ')' : ''));
console.log('dataset:        ' + data.length + ' (' + independent.length + ' independent, ' + aliases + ' aliases, ' + offered + ' offered)');
console.log('readme:         ' + (after === before ? 'already current' : 'counts updated'));
