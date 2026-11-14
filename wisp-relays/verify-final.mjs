import fs from 'node:fs';
const candidates = JSON.parse(fs.readFileSync('wisp-relays/final-candidates.json', 'utf8'));
const HOST = 'google.com';
const PORT = 80;
const TIMEOUT = Number(process.env.TIMEOUT || 12000);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
function packet(type, id, payload = Buffer.alloc(0)) { const b = Buffer.alloc(5 + payload.length); b[0] = type; b.writeUInt32LE(id >>> 0, 1); payload.copy(b, 5); return b; }
function connectPacket(id, host, port) { const h = Buffer.from(host, 'utf8'); const p = Buffer.alloc(3 + h.length); p[0] = 1; p.writeUInt16LE(port, 1); h.copy(p, 3); return packet(1, id, p); }
const dataPacket = (id, buf) => packet(2, id, Buffer.from(buf));
const infoPacket = () => packet(5, 0, Buffer.from([2, 1]));
function parse(buf) { if (buf.length < 5) return null; return { type: buf[0], id: buf.readUInt32LE(1), payload: buf.subarray(5) }; }
const toU8 = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));
function attempt(c) {
  return new Promise((resolve) => {
    const started = Date.now();
    let ws, stage = 'ws', done = false, version = 0, first = '', dataBytes = 0, closeReason = null;
    const finish = (ok, note) => {
      if (done) return; done = true; clearTimeout(timer);
      try { ws && ws.close(); } catch {}
      resolve({ url: c.url, name: c.name, aliases: c.aliases || [], ok, note, version, latencyMs: Date.now() - started, closeReason, dataBytes, firstLine: first.split('\r\n')[0] || '' });
    };
    const timer = setTimeout(() => finish(false, 'timeout:' + stage), TIMEOUT);
    try { ws = new WebSocket(c.url); } catch (e) { return finish(false, 'ws-error:' + e.message); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { stage = 'handshake'; };
    ws.onerror = () => {};
    ws.onclose = (e) => { if (!done) finish(false, 'closed:' + (e.code || '') + ':' + (e.reason || '')); };
    const sendConnect = () => {
      stage = 'connect';
      ws.send(connectPacket(1, HOST, PORT));
      ws.send(dataPacket(1, 'GET / HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n\r\n'));
    };
    ws.onmessage = (ev) => {
      const p = parse(Buffer.from(toU8(ev.data)));
      if (!p) return finish(false, 'bad-packet');
      if (p.type === 5) { version = p.payload[0] || 2; if (version >= 2) { ws.send(infoPacket()); stage = 'info-sent'; } return; }
      if (p.type === 3) { if (stage === 'handshake' || stage === 'info-sent') { version = version || 1; sendConnect(); } return; }
      if (p.type === 4) { closeReason = p.payload[0]; return finish(false, 'close-reason:' + closeReason); }
      if (p.type === 2 && p.id === 1) {
        dataBytes += p.payload.length;
        if (!first) first = Buffer.from(p.payload).toString('latin1');
        if (/^HTTP\//.test(first)) finish(true, 'http-ok');
      }
    };
  });
}
const results = [];
let idx = 0;
async function worker() {
  while (idx < candidates.length) {
    const c = candidates[idx++];
    let r = await attempt(c);
    if (!r.ok) { const r2 = await attempt(c); if (r2.ok) { r2.note = 'http-ok (retry)'; r = r2; } else { r.note = r.note + ' | retry:' + r2.note; } }
    results.push(r);
    console.log((r.ok ? 'OK   ' : 'FAIL ') + r.url + '  ' + r.note + '  v' + r.version + '  ' + r.latencyMs + 'ms  [' + (r.firstLine || '') + ']');
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
results.sort((a, b) => Number(b.ok) - Number(a.ok) || a.latencyMs - b.latencyMs);
fs.writeFileSync('wisp-relays/final-results.json', JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.ok);
fs.writeFileSync('wisp-relays/final-working.txt', ok.map((r) => r.url).join('\n') + '\n');
console.log('\nSTRICT WORKING ' + ok.length + '/' + results.length);
process.exit(0);
