// Harvests Wisp relay candidates from public sources, without any API token.
//
// Sources
//   * crt.sh certificate transparency: hostnames containing wisp/proxy-ish labels
//   * GitHub repository search (unauthenticated, 10 req/min)
//   * full repo tarballs for the search hits, scanned for wss:// literals
//     (bundled JS included, so config defaults are not missed)
//
// Output: discovery/candidates.json  [{ url, source }]
//
// Usage: node wisp-relays/discovery/harvest.mjs [--repos-only|--crt-only]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT_DIR = 'wisp-relays/discovery';
// CACHE_TAG lets a second pass keep its own cache instead of reusing the first's.
const CACHE = path.join(OUT_DIR, 'cache' + (process.env.CACHE_TAG ? '-' + process.env.CACHE_TAG : ''));
fs.mkdirSync(CACHE, { recursive: true });

const ARGS = new Set(process.argv.slice(2));
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- helpers
async function get(url, { binary = false, timeout = 45000, headers = {} } = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'wisp-discovery/1.0', ...headers },
        signal: AbortSignal.timeout(timeout),
        redirect: 'follow'
      });
      if (res.status === 429 || res.status === 403) {
        const wait = Number(res.headers.get('retry-after') || 30);
        log('  rate limited ' + res.status + ', waiting ' + wait + 's');
        await sleep(Math.min(wait, 60) * 1000);
        continue;
      }
      if (res.status >= 500) {
        if (attempt === 2) return { status: res.status, body: null };
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (!res.ok) return { status: res.status, body: null };
      const body = binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
      return { status: res.status, body };
    } catch (e) {
      if (attempt === 2) return { status: 0, error: e.message, body: null };
      await sleep(1200 * (attempt + 1));
    }
  }
  return { status: 0, body: null };
}

function normalize(raw) {
  let s = String(raw)
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/&#x2f;|&#47;/gi, '/')
    .trim();
  s = s.replace(/[.,;:'"`)\]}>]+$/, '');
  const m = s.match(/^wss?:\/\/[^\s"'<>`\\]+/i);
  if (!m) return null;
  s = m[0].replace(/^ws:/i, 'wss:');
  try {
    const u = new URL(s);
    if (!u.hostname || !u.hostname.includes('.')) return null;
    const p = u.pathname.replace(/\/+$/, '') || '/';
    return u.protocol + '//' + u.host.toLowerCase() + p;
  } catch {
    return null;
  }
}

function extract(text) {
  const found = new Set();
  for (const m of String(text).matchAll(/wss?:\/\/[^\s"'<>`\\),;]+/gi)) {
    const n = normalize(m[0]);
    if (n) found.add(n);
  }
  return found;
}

// Known endpoints, so a candidate list only contains genuinely unseen hosts.
function knownEndpoints() {
  const known = new Set();
  const files = fs.readdirSync('wisp-relays').filter((f) => /\.(txt|json)$/i.test(f));
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(path.join('wisp-relays', f), 'utf8'); } catch { continue; }
    for (const m of text.matchAll(/wss?:\/\/[^\s"'<>,;)\]}]+/gi)) {
      const n = normalize(m[0]);
      if (n) known.add(n);
    }
  }
  return known;
}

// ---------------------------------------------------------------- crt.sh
const CRT_QUERIES = [
  'wisp', 'wisp-relay', 'wisp-relays', 'wisp-server', 'wispserver', 'wisp-node'
];

async function harvestCrt() {
  const hosts = new Map();
  for (const q of CRT_QUERIES) {
    const file = path.join(CACHE, 'crt-' + q.replace(/[^a-z0-9]/gi, '_') + '.json');
    let rows;
    if (fs.existsSync(file)) {
      rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      const res = await get('https://crt.sh/?q=' + encodeURIComponent(q) + '&output=json');
      if (!res.body) { log('crt ' + q + ': ' + (res.status || res.error)); continue; }
      try { rows = JSON.parse(res.body); } catch { log('crt ' + q + ': bad json'); continue; }
      fs.writeFileSync(file, JSON.stringify(rows));
      await sleep(700);
    }
    for (const row of rows) {
      for (const name of String(row.name_value || '').split('\n')) {
        const host = name.trim().replace(/^\*\./, '').toLowerCase();
        if (!host || !host.includes('.')) continue;
        if (!/wisp/i.test(host)) continue;
        hosts.set(host, 'crt.sh');
      }
    }
    log('crt ' + q + ': ' + rows.length + ' certs, ' + hosts.size + ' wisp hosts so far');
  }
  return [...hosts].map(([host, source]) => ({
    url: 'wss://' + host + '/wisp/',
    source: source + ':' + host
  }));
}

// ---------------------------------------------------------------- github
const GH_QUERIES = process.env.GH_QUERY_FILE
  ? JSON.parse(fs.readFileSync(process.env.GH_QUERY_FILE, 'utf8'))
  : [
  'wisp proxy', 'wisp server', 'wisp relay', 'wisp-protocol', 'wisp unblocker',
  'wisp browser proxy', 'wisp interface', 'wisp http proxy', 'eaglercraft wisp',
  'wisp list', 'wisp docker', 'wisp vercel', 'wisp cloudflare', 'wisp fly.io',
  'wisp render', 'wisp railway', 'topic:wisp', 'wisp-proxy-list', 'bare-server wisp',
  'wisp websocket proxy', 'wisp client', 'wisp node', 'wisp serverless', 'wisp workers'
  ];

async function harvestRepos() {
  const repos = new Map();
  for (const q of GH_QUERIES) {
    const file = path.join(CACHE, 'gh-' + q.replace(/[^a-z0-9]/gi, '_') + '.json');
    let items = [];
    if (fs.existsSync(file)) {
      items = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      for (let page = 1; page <= 2; page += 1) {
        const url =
          'https://api.github.com/search/repositories?q=' +
          encodeURIComponent(q) +
          '&sort=updated&per_page=100&page=' + page;
        const headers = { Accept: 'application/vnd.github+json' };
        if (process.env.GH_TOKEN) headers.Authorization = 'Bearer ' + process.env.GH_TOKEN;
        const res = await get(url, { headers });
        if (!res.body) { log('gh ' + q + ' p' + page + ': ' + (res.status || res.error)); break; }
        let body;
        try { body = JSON.parse(res.body); } catch { break; }
        const batch = body.items || [];
        items.push(...batch);
        if (batch.length < 100) break;
        await sleep(6500);
      }
      fs.writeFileSync(file, JSON.stringify(items));
      // unauthenticated search allows 10 requests/minute; a token allows 30
      await sleep(process.env.GH_TOKEN ? 2500 : 6500);
    }
    for (const it of items) {
      if (!it || !it.full_name) continue;
      repos.set(it.full_name, {
        repo: it.full_name,
        branch: it.default_branch || 'main',
        size: it.size || 0,
        description: it.description || ''
      });
    }
    log('gh ' + q + ': ' + items.length + ' repos (' + repos.size + ' unique)');
  }
  return [...repos.values()];
}

// ---------------------------------------------------------------- tar
function tarEntries(buf) {
  const entries = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeStr = header.subarray(124, 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const type = String.fromCharCode(header[156] || 48);
    const start = off + 512;
    if (type === '0' || type === '\0' || type === '0') {
      if (start + size <= buf.length) entries.push({ name, data: buf.subarray(start, start + size) });
    }
    off = start + Math.ceil(size / 512) * 512;
  }
  return entries;
}

const SCANNABLE = /\.(m?js|cjs|jsx|ts|tsx|html?|json|md|txt|yml|yaml|toml|css|svg)$/i;

async function scanRepo(info) {
  const cacheFile = path.join(CACHE, 'tar-' + info.repo.replace(/[^a-z0-9]/gi, '_') + '.json');
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  if (info.size > 90000) {
    fs.writeFileSync(cacheFile, '[]');
    return [];
  }
  const branches = [info.branch, 'main', 'master'].filter((b, i, a) => b && a.indexOf(b) === i);
  for (const branch of branches) {
    const url = 'https://codeload.github.com/' + info.repo + '/tar.gz/refs/heads/' + branch;
    const res = await get(url, { binary: true, timeout: 60000 });
    if (!res.body || res.body.length < 1000) continue;
    let tar;
    try { tar = zlib.gunzipSync(res.body); } catch { continue; }
    const found = new Set();
    for (const entry of tarEntries(tar)) {
      if (!SCANNABLE.test(entry.name)) continue;
      if (entry.data.length > 3_000_000) continue;
      for (const n of extract(entry.data.toString('utf8'))) found.add(n);
    }
    const out = [...found].map((url) => ({ url, source: info.repo }));
    fs.writeFileSync(cacheFile, JSON.stringify(out));
    return out;
  }
  fs.writeFileSync(cacheFile, '[]');
  return [];
}

// ---------------------------------------------------------------- main
const known = knownEndpoints();
log('known endpoints in wisp-relays: ' + known.size);

const candidates = new Map();
function add(list, prefix) {
  let added = 0;
  for (const item of list) {
    const n = normalize(item.url);
    if (!n || known.has(n) || candidates.has(n)) continue;
    // Ignore obvious non-relay hosts: analytics, CDNs, wallets.
    if (/sentry|bugsnag|discord|googleapis|gstatic|firebase|cloudflareinsights|newrelic|datadog|amplitude|mixpanel|stripe|paypal|walletconnect|solanart|binance|coingecko/i.test(n)) continue;
    candidates.set(n, { url: item.url.replace(/^ws:/i, 'wss:'), source: prefix + ':' + item.source, normalized: n });
    added += 1;
  }
  return added;
}

if (!ARGS.has('--repos-only')) {
  const crt = await harvestCrt();
  log('crt candidates added: ' + add(crt, 'crt'));
}

if (!ARGS.has('--crt-only')) {
  const repos = await harvestRepos();
  log('scanning ' + repos.length + ' repo tarballs...');
  let done = 0;
  const results = [];
  for (let i = 0; i < repos.length; i += 8) {
    const chunk = repos.slice(i, i + 8);
    const batch = await Promise.all(chunk.map((r) => scanRepo(r)));
    for (const list of batch) results.push(...list);
    done += chunk.length;
    if (done % 40 === 0 || done === repos.length) log('  tarballs ' + done + '/' + repos.length);
  }
  log('repo candidates added: ' + add(results, 'gh'));
}

const out = [...candidates.values()].map(({ url, source }) => ({ url, source }));
const outName = 'candidates' + (process.env.CACHE_TAG ? '-' + process.env.CACHE_TAG : '') + '.json';
fs.writeFileSync(path.join(OUT_DIR, outName), JSON.stringify(out, null, 2));
log('TOTAL unseen candidates: ' + out.length);
bySource(out);
process.exit(0);

function bySource(list) {
  const m = {};
  for (const c of list) m[c.source.split(':')[0]] = (m[c.source.split(':')[0]] || 0) + 1;
  log('  ' + JSON.stringify(m));
}
