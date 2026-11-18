// One weekly discovery pass, end to end: harvest unseen candidates, resolve
// them, keep the endpoints that actually relay traffic, prove which of those are
// independent, and write the additions file that merge-additions.mjs folds into
// the published dataset.
//
// The pass stops at "verified relay plus evidence": ids, grouping, counts and the
// scanner stay with merge-additions.mjs and apply-eagler-compat.mjs, so this can
// run unattended and is safe to re-run.
//
// Usage: node wisp-relays/discovery/weekly.mjs
//
// env:
//   QUERY_FILE       GitHub query list instead of the ISO-week rotation
//   HARVEST_ARGS     extra harvest flags, e.g. "--repos-only"
//   CANDIDATES_FILE  skip harvesting and probe this candidate list instead
//   CACHE_TAG        suffix for caches and run artifacts (default weekly-YYYY-MM-DD)
//   MAX_COMPAT       cap on launcher-shaped probes per run (default 60)
//   GITHUB_TOKEN     forwarded to harvest.mjs as GH_TOKEN (higher search limits)

import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import { execFileSync } from 'node:child_process';

const DIR = 'wisp-relays/discovery';
const DATA = 'wisp-relays/scanner-relays-454.json';
const MAX_COMPAT = Number(process.env.MAX_COMPAT || 60);
const today = new Date().toISOString().slice(0, 10);
const tag = process.env.CACHE_TAG || 'weekly-' + today;
const log = (...args) => console.log(...args);

const run = (script, args = [], env = {}) =>
  execFileSync(process.execPath, [script, ...args], { stdio: 'inherit', env: { ...process.env, ...env } });

// Workflow steps take their result from this file rather than from the log.
function publish(name, value) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, name + '=' + value + '\n');
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

const hostOf = (url) => {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
};
const key = (url) => String(url || '').replace(/\/$/, '');

async function addresses(host) {
  if (!host) return new Set();
  try { return new Set((await dns.lookup(host, { all: true })).map((a) => a.address)); } catch { return new Set(); }
}

// ---------------------------------------------------------------- harvest
let candidatesPath = process.env.CANDIDATES_FILE;
if (!candidatesPath) {
  // The two query batches alternate by ISO week: one run stays well inside the
  // job timeout, and the whole query space is covered every fortnight.
  const week = isoWeek(new Date());
  const queryFile = process.env.QUERY_FILE || (week % 2 ? DIR + '/queries-batch2.json' : null);
  const env = { CACHE_TAG: tag, GH_QUERY_FILE: queryFile || '' };
  if (process.env.GITHUB_TOKEN) env.GH_TOKEN = process.env.GITHUB_TOKEN;
  log('weekly discovery ' + today + ' · week ' + week + ' · queries ' + (queryFile || 'built-in set'));
  run(DIR + '/harvest.mjs', (process.env.HARVEST_ARGS || '').split(' ').filter(Boolean), env);
  candidatesPath = path.join(DIR, 'candidates-' + tag + '.json');
}

const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf8'));
log('candidates: ' + candidates.length);
if (!candidates.length) {
  log('nothing unseen to probe');
  publish('added', 0);
  process.exit(0);
}

// ---------------------------------------------------------------- resolve + probe
run(DIR + '/resolve.mjs', [candidatesPath]);
const resolved = JSON.parse(fs.readFileSync(path.join(DIR, 'resolved.json'), 'utf8'));
if (!resolved.length) {
  log('no candidate hostname resolved');
  publish('added', 0);
  process.exit(0);
}

const resultsPath = path.join(DIR, 'weekly-results-' + tag + '.json');
run('wisp-relays/verify-generic.mjs', [path.join(DIR, 'resolved.json'), resultsPath], {
  TIMEOUT: '8000',
  CONCURRENCY: '24'
});
const working = JSON.parse(fs.readFileSync(resultsPath, 'utf8')).filter((r) => r.ok);
log('relaying HTTP: ' + working.length + '/' + resolved.length);

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const listed = new Set(data.map((r) => key(r.url)));
const fresh = working.filter((r) => r.host && !listed.has(key(r.url)));
if (!fresh.length) {
  log('every working endpoint is already listed');
  publish('added', 0);
  process.exit(0);
}

// A candidate is independent only when none of the addresses it answers on
// belongs to a relay already in the dataset; a second hostname on a known
// backend is an alias, not a new endpoint.
const owner = new Map();
const existingHosts = [...new Set(data.map((r) => hostOf(r.url)).filter(Boolean))];
for (let i = 0; i < existingHosts.length; i += 25) {
  const chunk = existingHosts.slice(i, i + 25);
  const found = await Promise.all(chunk.map(addresses));
  chunk.forEach((host, j) => {
    const relay = data.find((r) => hostOf(r.url) === host);
    for (const ip of found[j]) if (!owner.has(ip)) owner.set(ip, relay);
  });
}

const probed = [];
for (let i = 0; i < fresh.length; i += 25) {
  const chunk = fresh.slice(i, i + 25);
  const found = await Promise.all(chunk.map((r) => addresses(hostOf(r.url))));
  chunk.forEach((relay, j) => {
    const shared = [...new Set([...found[j]].map((ip) => owner.get(ip)).filter(Boolean))];
    probed.push({ ...relay, host: hostOf(relay.url), shared });
  });
}
const independent = probed.filter((p) => !p.shared.length);
const aliases = probed.filter((p) => p.shared.length);
log('new endpoints: ' + independent.length + ' independent · ' + aliases.length + ' alias');

const targets = [...independent, ...aliases].slice(0, MAX_COMPAT);
if (!targets.length) {
  log('no new endpoint to probe');
  publish('added', 0);
  process.exit(0);
}

const probeIn = path.join(DIR, 'weekly-probe-' + tag + '.json');
fs.writeFileSync(probeIn, JSON.stringify(targets.map((t) => ({ url: t.url, name: t.host })), null, 2) + '\n');
const probeOut = path.join(DIR, 'weekly-probe-%TAG%-compat.json'.replace('%TAG%', tag));
run('wisp-relays/eagler-compat.mjs', [probeIn, probeOut], { TIMEOUT: '50000', CONCURRENCY: '8' });
const evidence = new Map(JSON.parse(fs.readFileSync(probeOut, 'utf8')).map((row) => [key(row.url), row]));

// ---------------------------------------------------------------- additions
// Independent entries must pass the launcher-shaped probe; an alias may still be
// listed when its backend answers but Minecraft does not.
const relays = [];
const compat = [];
for (const target of targets) {
  const row = evidence.get(key(target.url));
  if (!row) continue;
  const isIndependent = !target.shared.length;
  if (isIndependent && row.classification !== 'ok') continue;
  if (!isIndependent && !['ok', 'mc-blocked'].includes(row.classification)) continue;
  const backend = isIndependent ? null : target.shared[0].name || hostOf(target.shared[0].url);
  relays.push({
    name: target.host,
    url: target.url,
    group: isIndependent ? 'independent' : 'alias',
    baseline: target.latencyMs,
    mc: row.ok === true,
    ...(isIndependent ? { eagler: 'ok' } : { backend })
  });
  if (isIndependent) compat.push(row);
}
if (!relays.length) {
  log('no new relay passed both probes');
  publish('added', 0);
  process.exit(0);
}

const additionsPath = 'wisp-relays/additions-' + today + '.json';
fs.writeFileSync(
  additionsPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note: 'Weekly discovery pass ' + today + ': strict HTTP probe plus launcher-shaped Minecraft probe, folded in by merge-additions.mjs.',
      relays,
      compat
    },
    null,
    2
  ) + '\n'
);

run('wisp-relays/merge-additions.mjs');
run('wisp-relays/apply-eagler-compat.mjs');

for (const relay of relays) log('added ' + relay.group.padEnd(11) + ' ' + relay.url);
publish('added', relays.length);
publish('additions', additionsPath);
