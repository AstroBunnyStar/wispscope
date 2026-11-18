// Resolves harvested candidates before probing: a relay whose hostname does not
// resolve cannot answer, and dropping it early keeps the WebSocket probe fast.
//
// Input:  discovery/candidates.json  [{url, source}]
//         discovery/leads.json     [{url, source}]   (hand-picked, from docs/issues)
// Output: discovery/resolved.json   [{url, source, address}]
//         discovery/unresolved.txt

import fs from 'node:fs';
import dns from 'node:dns/promises';
import path from 'node:path';

const DIR = 'wisp-relays/discovery';
const inputs = (process.argv.slice(2).length ? process.argv.slice(2) : ['candidates.json', 'leads.json'])
  .map((f) => (f.includes('/') || f.includes('\\') ? f : path.join(DIR, f)))
  .filter((f) => fs.existsSync(f));

const seen = new Map();
for (const file of inputs) {
  for (const c of JSON.parse(fs.readFileSync(file, 'utf8'))) {
    if (!c || !c.url) continue;
    let host;
    try { host = new URL(c.url).hostname.toLowerCase(); } catch { continue; }
    if (!seen.has(host)) seen.set(host, { url: c.url, source: c.source || path.basename(file) });
  }
}

const resolved = [];
const unresolved = [];
let done = 0;

async function check([host, item]) {
  try {
    const r = await dns.lookup(host, { all: false, timeout: 6000 });
    resolved.push({ ...item, host, address: r.address });
  } catch (e) {
    unresolved.push(host + '  ' + (e.code || e.message));
  }
  done += 1;
  if (done % 100 === 0) console.log('dns ' + done + '/' + seen.size);
}

const entries = [...seen.entries()];
for (let i = 0; i < entries.length; i += 40) {
  await Promise.all(entries.slice(i, i + 40).map(check));
}

fs.writeFileSync(path.join(DIR, 'resolved.json'), JSON.stringify(resolved, null, 2));
fs.writeFileSync(path.join(DIR, 'unresolved.txt'), unresolved.join('\n') + '\n');
console.log('candidates: ' + seen.size + '  resolved: ' + resolved.length + '  nxdomain: ' + unresolved.length);
