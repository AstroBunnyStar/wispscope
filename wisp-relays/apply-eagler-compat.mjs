// Re-applies Eaglercraft compatibility evidence onto the scanner.
//
// Source of truth: wisp-relays/eagler-compat.json (written by eagler-compat.mjs).
// Writes:          the `eagler` field on independent entries of scanner-relays-454.json,
//                  then regenerates wisp-scanner/index.html from scanner.template.html.
//
// A relay the evidence does not cover loses its `eagler` field, so the launcher
// dropdown cannot keep offering a relay on stale evidence.
//
// Usage: node wisp-relays/apply-eagler-compat.mjs
// Idempotent: a second run reports "no changes" and writes nothing, so the command
// doubles as the staleness check — there is no separate --check mode to remember.

import fs from 'node:fs';

const COMPAT = 'wisp-relays/eagler-compat.json';
const DATA = 'wisp-relays/scanner-relays-454.json';
const TEMPLATE = 'wisp-scanner/scanner.template.html';
const OUTPUT = 'wisp-scanner/index.html';
const CLASSES = new Set(['ok', 'mc-blocked', 'origin-blocked', 'wisp-fail', 'dead']);
const PLACEHOLDER = '__RELAY_DATA__';

function fail(message) {
  console.error(message);
  process.exit(2);
}

function read(file) {
  if (!fs.existsSync(file)) fail('missing input: ' + file);
  return fs.readFileSync(file, 'utf8');
}

const template = read(TEMPLATE);
if (!template.includes(PLACEHOLDER)) fail('template has no ' + PLACEHOLDER + ': ' + TEMPLATE);
const data = JSON.parse(read(DATA));

// Unknown values are skipped rather than fatal: the relay drops to "untested",
// and the warning below names the offending value.
const evidence = new Map();
const unknown = new Set();
for (const row of JSON.parse(read(COMPAT))) {
  if (!row || typeof row.url !== 'string') continue;
  if (CLASSES.has(row.classification)) evidence.set(row.url, row.classification);
  else unknown.add(String(row.classification));
}
if (unknown.size) console.warn('ignoring unknown classification(s): ' + [...unknown].join(', '));

const changes = [];
const next = data.map((relay) => {
  if (relay.group !== 'independent') return relay;
  const wanted = evidence.get(relay.url) || null;
  // Spread keeps any field this script does not know about, and keeps `eagler`
  // where it already sits; only relays gaining it for the first time append.
  const out = { ...relay };
  if (wanted) out.eagler = wanted;
  else delete out.eagler;
  if (out.eagler !== relay.eagler) {
    changes.push((relay.eagler || 'none') + ' -> ' + (wanted || 'none') + '  ' + relay.url);
  }
  return out;
});

const independent = next.filter((r) => r.group === 'independent');
const offered = independent.filter((r) => r.eagler === 'ok').length;
const untested = independent.filter((r) => !r.eagler).length;
const orphans = [...evidence.keys()].filter((url) => !data.some((r) => r.url === url));

const dataText = JSON.stringify(next, null, 2) + '\n';
const htmlText = template.replace(PLACEHOLDER, JSON.stringify(next).replace(/</g, '\\u003c'));

const written = [];
if (read(DATA) !== dataText) {
  fs.writeFileSync(DATA, dataText);
  written.push(DATA);
}
if (!fs.existsSync(OUTPUT) || read(OUTPUT) !== htmlText) {
  fs.writeFileSync(OUTPUT, htmlText);
  written.push(OUTPUT);
}

console.log('evidence: ' + evidence.size + ' relay(s) from ' + COMPAT);
console.log('dataset:  ' + independent.length + ' independent · ' + offered + ' offered · ' + untested + ' untested');
console.log(changes.length ? 'changed:  ' + changes.length : 'changed:  none');
for (const change of changes) console.log('  ' + change);
console.log('wrote:    ' + (written.length ? written.join(', ') : 'nothing (already current)'));

if (orphans.length) {
  console.log('note: ' + orphans.length + ' compat URL(s) are not independent entries in the dataset:');
  for (const url of orphans) console.log('  ' + url);
}
