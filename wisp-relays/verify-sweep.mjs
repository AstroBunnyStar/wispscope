import fs from 'node:fs';
const candidates = JSON.parse(fs.readFileSync('wisp-relays/sweep-candidates.json', 'utf8'));
const HOST = 'google.com', PORT = 80, TIMEOUT = Number(process.env.TIMEOUT || 5000), CONCURRENCY = Number(process.env.CONCURRENCY || 60);
function packet(type, id, payload = Buffer.alloc(0)) { const b = Buffer.alloc(5 + payload.length); b[0] = type; b.writeUInt32LE(id >>> 0, 1); payload.copy(b, 5); return b; }
function connectPacket(id, host, port) { const h = Buffer.from(host, 'utf8'); const p = Buffer.alloc(3 + h.length); p[0] = 1; p.writeUInt16LE(port, 1); h.copy(p, 3); return packet(1, id, p); }
const dataPacket = (id, buf) => packet(2, id, Buffer.from(buf));
const infoPacket = () => packet(5, 0, Buffer.from([2, 1]));
function parse(buf) { if (buf.length < 5) return null; return { type: buf[0], id: buf.readUInt32LE(1), payload: buf.subarray(5) }; }
const toU8 = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));
function attempt(c) {
  return new Promise((resolve) => {
    const started = Date.now(); let ws, stage = 'ws', done = false, version = 0, first = '';
    const finish = (ok, note) => { if (done) return; done = true; clearTimeout(timer); try { ws && ws.close(); } catch {} resolve({ url: c.url, source: c.source, ok, note, version, latencyMs: Date.now() - started, firstLine: first.split('\r\n')[0] || '' }); };
    const timer = setTimeout(() => finish(false, 'timeout:' + stage), TIMEOUT);
    try { ws = new WebSocket(c.url); } catch (e) { return finish(false, 'ws-error'); }
    ws.binaryType = 'arraybuffer'; ws.onopen = () => { stage = 'handshake'; }; ws.onerror = () => {};
    ws.onclose = (e) => { if (!done) finish(false, 'closed:' + e.code); };
    const sendConnect = () => { stage = 'connect'; ws.send(connectPacket(1, HOST, PORT)); ws.send(dataPacket(1, 'GET / HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n\r\n')); };
    ws.onmessage = (ev) => {
      const p = parse(Buffer.from(toU8(ev.data))); if (!p) return finish(false, 'bad-packet');
      if (p.type === 5) { version = p.payload[0] || 2; if (version >= 2) { ws.send(infoPacket()); stage = 'info-sent'; } return; }
      if (p.type === 3) { if (stage === 'handshake' || stage === 'info-sent') { version = version || 1; sendConnect(); } return; }
      if (p.type === 4) return finish(false, 'close-reason:' + p.payload[0]);
      if (p.type === 2 && p.id === 1) { if (!first) first = Buffer.from(p.payload).toString('latin1'); if (/^HTTP\//.test(first)) finish(true, 'http-ok'); }
    };
  });
}
const results = []; let idx = 0, done = 0;
async function worker() { while (idx < candidates.length) { const r = await attempt(candidates[idx++]); results.push(r); if (++done % 250 === 0) console.log('progress ' + done + '/' + candidates.length + ' ok=' + results.filter(x => x.ok).length); } }
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
results.sort((a, b) => Number(b.ok) - Number(a.ok) || a.latencyMs - b.latencyMs);
fs.writeFileSync('wisp-relays/sweep-results.json', JSON.stringify(results, null, 2));
const ok = results.filter(r => r.ok);
fs.writeFileSync('wisp-relays/sweep-working.txt', ok.map(r => r.url).join('\n') + '\n');
console.log('SWEEP WORKING ' + ok.length + '/' + results.length);
for (const r of ok) console.log('OK ' + r.url + ' ' + r.latencyMs + 'ms');
process.exit(0);
