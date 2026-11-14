import fs from 'node:fs';

const input = process.argv[2] || 'wisp-relays/candidates.json';
const out = process.argv[3] || 'wisp-relays/results.json';
const candidates = JSON.parse(fs.readFileSync(input, 'utf8'));
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const HOST = 'example.com';
const PORT = 80;
const TIMEOUT = Number(process.env.TIMEOUT || 14000);

function packet(type, streamId, payload = Buffer.alloc(0)) {
  const b = Buffer.alloc(5 + payload.length);
  b[0] = type;
  b.writeUInt32LE(streamId >>> 0, 1);
  payload.copy(b, 5);
  return b;
}
function connectPacket(streamId, host, port, streamType = 1) {
  const hostBuf = Buffer.from(host, 'utf8');
  const p = Buffer.alloc(3 + hostBuf.length);
  p[0] = streamType;
  p.writeUInt16LE(port, 1);
  hostBuf.copy(p, 3);
  return packet(1, streamId, p);
}
const dataPacket = (id, buf) => packet(2, id, Buffer.from(buf));
const infoPacket = () => packet(5, 0, Buffer.from([2, 1]));
function parse(buf) {
  if (buf.length < 5) return null;
  return { type: buf[0], streamId: buf.readUInt32LE(1), payload: buf.subarray(5) };
}
const toU8 = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));

function testOne(c) {
  return new Promise((resolve) => {
    const started = Date.now();
    let ws, stage = 'ws', done = false, version = 0, closeReason = null, dataBytes = 0, firstData = '';
    const finish = (ok, note) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws && ws.close(); } catch {}
      resolve({ url: c.url, name: c.name || null, source: c.source || null, ok, note, version, latencyMs: Date.now() - started, closeReason, dataBytes, firstData });
    };
    const timer = setTimeout(() => finish(false, 'timeout:' + stage), TIMEOUT);
    try { ws = new WebSocket(c.url); } catch (e) { return finish(false, 'ws-error:' + e.message); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { stage = 'handshake'; };
    ws.onerror = () => {};
    ws.onclose = (e) => { if (!done) finish(false, 'closed:' + (e.code || '') + ' ' + (e.reason || '')); };
    const sendConnect = () => {
      stage = 'connect';
      ws.send(connectPacket(1, HOST, PORT));
      ws.send(dataPacket(1, 'GET / HTTP/1.1\r\nHost: ' + HOST + '\r\nConnection: close\r\n\r\n'));
      setTimeout(() => { if (!done && dataBytes === 0) finish(false, 'no-data'); }, 8000);
    };
    ws.onmessage = (ev) => {
      const p = parse(Buffer.from(toU8(ev.data)));
      if (!p) return finish(false, 'bad-packet');
      if (p.type === 5) {
        version = p.payload[0] || 2;
        if (version >= 2) { ws.send(infoPacket()); stage = 'info-sent'; }
        return;
      }
      if (p.type === 3) {
        if (stage === 'handshake' || stage === 'info-sent') { version = version || 1; sendConnect(); }
        return;
      }
      if (p.type === 4) {
        closeReason = p.payload[0];
        return finish(false, 'close-reason:' + closeReason);
      }
      if (p.type === 2 && p.streamId === 1) {
        dataBytes += p.payload.length;
        if (!firstData) firstData = Buffer.from(p.payload).toString('latin1').slice(0, 100);
        if (/^HTTP\//.test(firstData) || dataBytes > 0) finish(true, 'http-ok');
      }
    };
  });
}

const results = [];
let idx = 0;
async function worker() {
  while (idx < candidates.length) {
    const c = candidates[idx++];
    const r = await testOne(c);
    results.push(r);
    console.log((r.ok ? 'OK   ' : 'FAIL ') + r.url + '  ' + (r.note || '') + '  v' + r.version + '  ' + r.latencyMs + 'ms' + (r.firstData ? '  [' + r.firstData.replace(/[^\x20-\x7e]/g, '.') + ']' : ''));
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
results.sort((a, b) => Number(b.ok) - Number(a.ok) || a.latencyMs - b.latencyMs);
fs.writeFileSync(out, JSON.stringify(results, null, 2));
const ok = results.filter((r) => r.ok);
fs.writeFileSync(out.replace(/\.json$/, '') + '-working.txt', ok.map((r) => r.url).join('\n') + '\n');
console.log('\nWORKING ' + ok.length + '/' + results.length);

process.exit(0);
