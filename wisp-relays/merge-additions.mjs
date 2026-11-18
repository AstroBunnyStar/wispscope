// Folds wisp-relays/additions-*.json into the published dataset.
//
// Each additions file carries relays verified by a discovery pass, plus the
// Eaglercraft evidence for the independent ones. Keeping these in small files
// means a new relay costs a 2 KB commit instead of a 100 KB regenerated
// dataset, and CI materialises the dataset and the scanner from them.
//
// Idempotent: relay URLs, evidence rows and independent-list entries already
// present are skipped, so a repeated run writes nothing.
//
// Usage: node wisp-relays/merge-additions.mjs

import fs from 'node:fs';
import path from 'node:path';

const DATA = 'wisp-relays/scanner-relays-454.json';
const COMPAT = 'wisp-relays/eagler-compat.json';
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
let addedRelays = 0;
let addedEvidence = 0;
const newUrls = [];

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

if (!addedRelays && !addedEvidence) {
  console.log('additions: none pending (' + additions.length + ' file(s) already folded in)');
  process.exit(0);
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(COMPAT, JSON.stringify(compat, null, 2) + '\n');

// A new snapshot alongside the older ones: this repository keeps every
// independent-<n>.txt as history rather than replacing the previous list.
const target = path.join(DIR, 'independent-' + independent.length + '.txt');
fs.writeFileSync(target, independent.join('\n') + '\n');

// The verified pool and the README counts are derived state: keep them in step
// here so a new relay does not need a hand-edited 70 KB list.
const TOTAL = path.join(DIR, 'verified-total.txt');
const verified = fs.readFileSync(TOTAL, 'utf8').split(/\r?\n/).filter(Boolean);
const verifiedSet = new Set(verified.map(key));
for (const url of newUrls) {
  if (verifiedSet.has(key(url))) continue;
  verified.push(url);
  verifiedSet.add(key(url));
}
fs.writeFileSync(TOTAL, verified.join('\n') + '\n');

const README = 'README.md';
const offered = data.filter((r) => r.group === 'independent' && r.eagler === 'ok').length;
let readme = fs.readFileSync(README, 'utf8');
readme = readme
  .replace(/\*\*[\d,]+ relay URLs\*\*/, '**' + data.length + ' relay URLs**')
  .replace(/- \*\*[\d,]+ independent endpoints\*\* in `wisp-relays\/independent-[\d]+\.txt`/,
    '- **' + independent.length + ' independent endpoints** in `wisp-relays/independent-' + independent.length + '.txt`')
  .replace(/- \*\*[\d,]+ aliases\*\* in `wisp-relays\/scanner-relays-[\d]+\.json`/,
    '- **' + data.filter((r) => r.group === 'alias').length + ' aliases** in `wisp-relays/' + path.basename(DATA) + '`')
  .replace(/- \*\*[\d,]+ verified URLs\*\* including the wider alias pool/,
    '- **' + verified.length.toLocaleString('en-US') + ' verified URLs** including the wider alias pool')
  .replace(/\*\*[\d]+ of the [\d]+\*\* independent endpoints also pass/,
    '**' + offered + ' of the ' + independent.length + '** independent endpoints also pass')
  // every remaining reference to the old independent-list filename
  .replace(/independent-\d+\.txt/g, 'independent-' + independent.length + '.txt');
fs.writeFileSync(README, readme);
readme = fs.readFileSync(README, 'utf8');

console.log('added relays:   ' + addedRelays);
console.log('added evidence: ' + addedEvidence);
console.log('dataset:        ' + data.length);
console.log('independent:    ' + independent.length + ' (' + target + ')');
console.log('verified pool:  ' + verified.length);
console.log('readme counts:  ' + [data.length, independent.length, offered].join(' / '));
