// Eaglercraft compatibility verifier.
//
// WispScope's normal probe connects to google.com:80 with no Origin header, which is
// not what the Eaglercraft launcher does. This verifier reproduces the launcher:
//   * WebSocket upgrade carries Origin: https://astrobunnystar.github.io
//   * the Wisp CONNECT target is a real Minecraft server on 25565
//   * success requires a parsed Minecraft status response, not just an HTTP byte
//
// Each relay is classified so the scanner can gate its dropdown on real evidence:
//   ok              - Minecraft status received through the relay
//   mc-blocked      - Wisp works, but CONNECT to Minecraft failed on every target
//   origin-blocked  - upgrade refused with this Origin, accepted without it
//   wisp-fail       - upgrade accepted, Wisp handshake/connect never completed
//   dead            - refused without the Origin too
//
// Usage:
//   node wisp-relays/eagler-compat.mjs [input] [output]
//
// input: .txt (one wss:// URL per line) or .json ([{url,name}] or {url})
// defaults: wisp-relays/independent-53.txt -> wisp-relays/eagler-compat.json
//
// env:
//   EAGLER_ORIGIN   page origin the launcher runs on (default https://astrobunnystar.github.io)
//   MC_HOST/MC_PORT single Minecraft target override
//   TIMEOUT         overall per-relay budget in ms (default 40000)
//   MC_TIMEOUT      per-target Minecraft wait in ms (default 9000)
//   CONCURRENCY     parallel relays (default 8)
//   NO_CONTROL=1    skip the no-Origin control probe

import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';

const ORIGIN = process.env.EAGLER_ORIGIN || 'https://astrobunnystar.github.io';
const TIMEOUT = Number(process.env.TIMEOUT || 40000);
const MC_TIMEOUT = Number(process.env.MC_TIMEOUT || 9000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const CONTROL = process.env.NO_CONTROL !== '1';

const TARGETS = process.env.MC_HOST
  ? [{ host: process.env.MC_HOST, port: Number(process.env.MC_PORT || 25565), label: process.env.MC_HOST }]
  : [
      { host: 'mc.hypixel.net', port: 25565, label: 'Hypixel' },
      { host: 'play.cubecraft.net', port: 25565, label: 'CubeCraft' },
      { host: 'mc.originrealms.com', port: 25565, label: 'Origin Realms' }
    ];

const inputPath = process.argv[2] || 'wisp-relays/independent-53.txt';
const outputPath = process.argv[3] || 'wisp-relays/eagler-compat.json';

function readInput(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    const data = JSON.parse(raw);
    return data.map((entry) => (typeof entry === 'string' ? { url: entry } : { url: entry.url, name: entry.name }));
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^wss?:\/\//i.test(line))
    .map((url) => ({ url }));
}

// Raw upgrade probe: gives us the actual HTTP status, which the DOM WebSocket API hides.
// 101 means the relay accepted the handshake; 4xx usually means an Origin/ACL rejection.
function upgradeStatus(rawUrl, origin, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let req = null;
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { req && req.destroy(); } catch {}
      resolve(result);
    };
    let u;
    try {
      u = new URL(rawUrl);
    } catch {
      return done({ status: 0, error: 'bad-url' });
    }
    if (u.protocol !== 'wss:' && u.protocol !== 'ws:') return done({ status: 0, error: 'bad-scheme' });
    const mod = u.protocol === 'wss:' ? https : http;
    const headers = {
      Connection: 'Upgrade',
      Upgrade: 'websocket',
      'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
      'Sec-WebSocket-Version': '13'
    };
    if (origin) headers.Origin = origin;
    const timer = setTimeout(() => done({ status: 0, error: 'timeout' }), timeoutMs);
    try {
      req = mod.request({
        hostname: u.hostname.replace(/^\[|\]$/g, ''),
        port: u.port || (u.protocol === 'wss:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'GET',
        headers,
        servername: u.hostname.replace(/^\[|\]$/g, '')
      });
    } catch (e) {
      return done({ status: 0, error: 'request-error:' + e.message });
    }
    req.on('upgrade', (res, socket) => {
      try { socket.destroy(); } catch {}
      done({ status: res.statusCode || 101 });
    });
    req.on('response', (res) => {
      res.resume();
      done({ status: res.statusCode || 0 });
    });
    req.on('error', (e) => done({ status: 0, error: e.code || e.message }));
    req.on('timeout', () => done({ status: 0, error: 'timeout' }));
    req.end();
  });
}

// ---- Wisp protocol ----
function packet(type, id, payload = Buffer.alloc(0)) {
  const b = Buffer.alloc(5 + payload.length);
  b[0] = type;
  b.writeUInt32LE(id >>> 0, 1);
  payload.copy(b, 5);
  return b;
}
function connectPacket(id, host, port) {
  const h = Buffer.from(host, 'utf8');
  const p = Buffer.alloc(3 + h.length);
  p[0] = 1;
  p.writeUInt16LE(port, 1);
  h.copy(p, 3);
  return packet(1, id, p);
}
const dataPacket = (id, buf) => packet(2, id, Buffer.from(buf));
const infoPacket = () => packet(5, 0, Buffer.from([2, 1]));
function parseWisp(buf) {
  if (buf.length < 5) return null;
  return { type: buf[0], id: buf.readUInt32LE(1), payload: buf.subarray(5) };
}

// ---- Minecraft status ping ----
function varint(n) {
  const out = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return Buffer.from(out);
}
function readVarInt(buf, offset = 0) {
  let value = 0;
  let size = 0;
  let byte;
  do {
    if (offset + size >= buf.length) return null;
    byte = buf[offset + size];
    value |= (byte & 0x7f) << (7 * size);
    size++;
    if (size > 5) return null;
  } while (byte & 0x80);
  return { value: value >>> 0, size };
}
function mcHandshake(host, port) {
  const h = Buffer.from(host, 'utf8');
  const body = Buffer.concat([
    varint(0),
    varint(47),
    varint(h.length),
    h,
    Buffer.from([(port >> 8) & 255, port & 255]),
    varint(1)
  ]);
  return Buffer.concat([varint(body.length), body]);
}
function parseStatus(buf) {
  const len = readVarInt(buf, 0);
  if (!len) return null;
  if (buf.length < len.size + len.value) return null;
  const body = buf.subarray(len.size, len.size + len.value);
  const id = readVarInt(body, 0);
  if (!id || id.value !== 0) return null;
  const sl = readVarInt(body, id.size);
  if (!sl) return null;
  if (body.length < id.size + sl.size + sl.value) return null;
  const text = body.subarray(id.size + sl.size, id.size + sl.size + sl.value).toString('utf8');
  try {
    const json = JSON.parse(text);
    if (json && (json.version || json.players)) return json;
  } catch {}
  return null;
}

// Full launcher-shaped probe: Origin included, Minecraft target, status JSON required.
function probeEagler(entry) {
  return new Promise((resolve) => {
    const started = Date.now();
    let ws = null;
    let targetIdx = 0;
    let current = TARGETS[0];
    let stage = 'ws';
    let done = false;
    let version = 0;
    let acc = Buffer.alloc(0);
    let lastNote = '';
    let targetTimer = null;

    const finish = (ok, note, extra = {}) => {
      if (done) return;
      done = true;
      clearTimeout(globalTimer);
      clearTimeout(targetTimer);
      try { ws && ws.close(); } catch {}
      resolve({
        url: entry.url,
        name: entry.name || null,
        ok,
        mcOk: ok,
        note,
        wispVersion: version,
        mcTarget: extra.mcTarget || null,
        mcVersion: extra.mcVersion || null,
        mcPlayers: extra.mcPlayers == null ? null : extra.mcPlayers,
        latencyMs: Date.now() - started,
        ...extra.flags
      });
    };

    const armTarget = () => {
      clearTimeout(targetTimer);
      targetTimer = setTimeout(() => {
        lastNote = 'mc-timeout:' + current.label;
        nextTarget();
      }, MC_TIMEOUT);
    };

    const sendMc = () => {
      stage = 'mc';
      acc = Buffer.alloc(0);
      try {
        ws.send(connectPacket(1, current.host, current.port));
        ws.send(dataPacket(1, Buffer.concat([mcHandshake(current.host, current.port), Buffer.from([0x01, 0x00])])));
      } catch {
        return finish(false, 'send-failed');
      }
      armTarget();
    };

    const nextTarget = () => {
      clearTimeout(targetTimer);
      targetIdx += 1;
      if (targetIdx >= TARGETS.length) {
        return finish(false, 'mc-blocked:' + (lastNote || 'no-target-answered'), {});
      }
      current = TARGETS[targetIdx];
      sendMc();
    };

    const globalTimer = setTimeout(() => finish(false, 'timeout:' + stage), TIMEOUT);

    try {
      ws = new WebSocket(entry.url, { headers: { Origin: ORIGIN } });
    } catch (e) {
      return finish(false, 'ws-error:' + e.message);
    }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { stage = 'handshake'; };
    ws.onerror = () => {};
    ws.onclose = (e) => {
      if (done) return;
      if (stage === 'mc') {
        lastNote = 'close:' + (e.code || '?');
        return nextTarget();
      }
      finish(false, 'closed:' + (e.code || '?') + ':' + stage);
    };
    ws.onmessage = (ev) => {
      const p = parseWisp(Buffer.from(new Uint8Array(ev.data)));
      if (!p) return finish(false, 'bad-packet');
      if (p.type === 5) {
        version = p.payload[0] || 2;
        if (version >= 2) {
          try { ws.send(infoPacket()); } catch {}
          stage = 'info-sent';
        }
        return;
      }
      if (p.type === 3) {
        if (stage === 'handshake' || stage === 'info-sent') {
          version = version || 1;
          sendMc();
        }
        return;
      }
      if (p.type === 4) {
        lastNote = 'wisp-close:' + (p.payload[0] == null ? '?' : p.payload[0]);
        if (stage === 'mc') return nextTarget();
        return finish(false, lastNote);
      }
      if (p.type === 2 && p.id === 1) {
        acc = Buffer.concat([acc, Buffer.from(p.payload)]);
        const status = parseStatus(acc);
        if (status) {
          clearTimeout(targetTimer);
          return finish(true, 'mc-status-ok', {
            mcTarget: current.label,
            mcVersion: (status.version && status.version.name) || null,
            mcPlayers: (status.players && status.players.online) == null ? null : status.players.online
          });
        }
      }
    };
  });
}

const entries = readInput(inputPath);
const results = [];
let idx = 0;
let done = 0;

async function worker() {
  while (idx < entries.length) {
    const entry = entries[idx++];
    const originProbe = await upgradeStatus(entry.url, ORIGIN, Math.min(TIMEOUT, 8000));
    const flags = { originStatus: originProbe.status, controlStatus: null };

    if (originProbe.status === 101) {
      const probe = await probeEagler(entry);
      const classification = probe.ok ? 'ok' : probe.note.startsWith('mc-blocked') ? 'mc-blocked' : 'wisp-fail';
      results.push({ ...probe, ...flags, classification });
    } else if (CONTROL) {
      const control = await upgradeStatus(entry.url, null, Math.min(TIMEOUT, 8000));
      flags.controlStatus = control.status;
      const originBlocked = control.status === 101;
      results.push({
        url: entry.url,
        name: entry.name || null,
        ok: false,
        mcOk: false,
        note: originBlocked
          ? 'origin-blocked:' + originProbe.status + ' with Origin, ' + control.status + ' without'
          : 'unreachable:' + (originProbe.error || originProbe.status),
        wispVersion: 0,
        mcTarget: null,
        mcVersion: null,
        mcPlayers: null,
        latencyMs: 0,
        ...flags,
        classification: originBlocked ? 'origin-blocked' : 'dead'
      });
    } else {
      results.push({
        url: entry.url,
        name: entry.name || null,
        ok: false,
        mcOk: false,
        note: 'unreachable:' + (originProbe.error || originProbe.status),
        wispVersion: 0,
        mcTarget: null,
        mcVersion: null,
        mcPlayers: null,
        latencyMs: 0,
        ...flags,
        classification: 'dead'
      });
    }

    const r = results[results.length - 1];
    done += 1;
    console.log(
      String(done).padStart(3) + '/' + entries.length +
      '  ' + r.classification.padEnd(15) +
      '  ' + String(r.latencyMs).padStart(6) + 'ms  ' + r.url +
      (r.note ? '  ' + r.note : '')
    );
  }
}

console.log('Eaglercraft-compat probe');
console.log('  origin:    ' + ORIGIN);
console.log('  mc target: ' + TARGETS.map((t) => t.host + ':' + t.port).join(', '));
console.log('  input:     ' + inputPath + ' (' + entries.length + ' relays)');
console.log('');

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));

const rank = { ok: 0, 'mc-blocked': 1, 'origin-blocked': 2, 'wisp-fail': 3, dead: 4 };
results.sort(
  (a, b) => (rank[a.classification] ?? 9) - (rank[b.classification] ?? 9) || a.latencyMs - b.latencyMs
);

const counts = {};
for (const r of results) counts[r.classification] = (counts[r.classification] || 0) + 1;

fs.writeFileSync(outputPath, JSON.stringify(results, null, 2) + '\n');
const workingPath = outputPath.replace(/\.json$/, '-working.txt');
fs.writeFileSync(workingPath, results.filter((r) => r.ok).map((r) => r.url).join('\n') + (results.some((r) => r.ok) ? '\n' : ''));

const summaryPath = outputPath.replace(/\.json$/, '-summary.json');
fs.writeFileSync(
  summaryPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      origin: ORIGIN,
      mcTargets: TARGETS.map((t) => t.host + ':' + t.port),
      total: results.length,
      counts,
      ok: results.filter((r) => r.ok).map((r) => ({ url: r.url, name: r.name, latencyMs: r.latencyMs, mcTarget: r.mcTarget })),
      blocked: results
        .filter((r) => !r.ok)
        .map((r) => ({ url: r.url, name: r.name, classification: r.classification, note: r.note }))
    },
    null,
    2
  ) + '\n'
);

console.log('');
for (const [key, value] of Object.entries(counts).sort((a, b) => (rank[a[0]] ?? 9) - (rank[b[0]] ?? 9))) {
  console.log('  ' + key.padEnd(15) + value);
}
console.log('EAGLER-OK ' + (counts.ok || 0) + '/' + results.length);
for (const r of results.filter((x) => x.ok)) {
  console.log('OK ' + r.url + '  ' + r.latencyMs + 'ms  ' + r.mcTarget + '  ' + (r.mcVersion || ''));
}
process.exit(0);
