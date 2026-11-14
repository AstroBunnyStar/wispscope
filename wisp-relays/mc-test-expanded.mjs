import fs from 'node:fs';
const results = JSON.parse((process.env.MC_INPUT ? fs.readFileSync(process.env.MC_INPUT, 'utf8') : fs.readFileSync('wisp-relays/final-results.json', 'utf8'))).filter(r => r.ok);
const TARGETS = [
  { host: 'mc.hypixel.net', port: 25565, label: 'Hypixel' },
  { host: 'play.cubecraft.net', port: 25565, label: 'CubeCraft' },
  { host: 'mc.originrealms.com', port: 25565, label: 'Origin Realms' }
];
const TIMEOUT = Number(process.env.MC_TIMEOUT || 9000);
const CONCURRENCY = Number(process.env.MC_CONCURRENCY || 10);
function packet(type, id, payload = Buffer.alloc(0)) { const b = Buffer.alloc(5 + payload.length); b[0] = type; b.writeUInt32LE(id >>> 0, 1); payload.copy(b, 5); return b; }
function connectPacket(id, host, port) { const h = Buffer.from(host, 'utf8'); const p = Buffer.alloc(3 + h.length); p[0] = 1; p.writeUInt16LE(port, 1); h.copy(p, 3); return packet(1, id, p); }
const dataPacket = (id, buf) => packet(2, id, Buffer.from(buf));
const infoPacket = () => packet(5, 0, Buffer.from([2, 1]));
function parseWisp(buf) { if (buf.length < 5) return null; return { type: buf[0], id: buf.readUInt32LE(1), payload: buf.subarray(5) }; }
function varint(n) { const out = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n); return Buffer.from(out); }
function readVarInt(buf, offset = 0) { let value = 0, size = 0, byte; do { if (offset + size >= buf.length) return null; byte = buf[offset + size]; value |= (byte & 0x7f) << (7 * size); size++; if (size > 5) return null; } while (byte & 0x80); return { value: value >>> 0, size }; }
function mcHandshake(host, port) {
  const h = Buffer.from(host, 'utf8');
  const p = Buffer.concat([varint(0), varint(47), varint(h.length), h, Buffer.from([(port >> 8) & 255, port & 255]), varint(1)]);
  return Buffer.concat([varint(p.length), p]);
}
function parseStatus(buf) {
  const len = readVarInt(buf, 0); if (!len) return null;
  if (buf.length < len.size + len.value) return null;
  const body = buf.subarray(len.size, len.size + len.value);
  const id = readVarInt(body, 0); if (!id || id.value !== 0) return null;
  const sl = readVarInt(body, id.size); if (!sl) return null;
  if (body.length < id.size + sl.size + sl.value) return null;
  const text = body.subarray(id.size + sl.size, id.size + sl.size + sl.value).toString('utf8');
  try { const j = JSON.parse(text); if (j && (j.version || j.players)) return j; } catch {}
  return null;
}
function testRelay(relay) {
  return new Promise((resolve) => {
    let ws, targetIdx = 0, stage = 'ws', done = false, acc = Buffer.alloc(0), version = 0, current = TARGETS[0], mcNote = '', mcOk = false;
    const timer = setTimeout(() => finish(false, 'timeout:' + stage), TIMEOUT);
    function finish(ok, note) { if (done) return; done = true; clearTimeout(timer); try { ws && ws.close(); } catch {} resolve({ url: relay.url, name: relay.name, mcOk, mcTarget: current.label, mcNote: note, latencyMs: relay.latencyMs, version }); }
    try { ws = new WebSocket(relay.url); } catch (e) { return resolve({ url: relay.url, name: relay.name, mcOk: false, mcTarget: null, mcNote: 'ws-error:' + e.message, latencyMs: relay.latencyMs, version: 0 }); }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { stage = 'handshake'; };
    ws.onerror = () => {};
    ws.onclose = (e) => { if (!done) finish(false, 'closed:' + e.code + ':' + e.reason); };
    const sendMc = () => {
      stage = 'mc';
      acc = Buffer.alloc(0);
      ws.send(connectPacket(1, current.host, current.port));
      ws.send(dataPacket(1, Buffer.concat([mcHandshake(current.host, current.port), Buffer.from([0x01, 0x00])])));
    };
    const nextTarget = () => {
      targetIdx++;
      if (targetIdx >= TARGETS.length) return finish(false, 'all-targets-failed:' + mcNote);
      current = TARGETS[targetIdx];
      sendMc();
    };
    ws.onmessage = (ev) => {
      const p = parseWisp(Buffer.from(new Uint8Array(ev.data)));
      if (!p) return finish(false, 'bad-packet');
      if (p.type === 5) { version = p.payload[0] || 2; if (version >= 2) { ws.send(infoPacket()); stage = 'info-sent'; } return; }
      if (p.type === 3) { if (stage === 'handshake' || stage === 'info-sent') { version = version || 1; sendMc(); } return; }
      if (p.type === 4) { mcNote = 'close:' + p.payload[0]; if (targetIdx + 1 < TARGETS.length) return nextTarget(); return finish(false, mcNote); }
      if (p.type === 2 && p.id === 1) {
        acc = Buffer.concat([acc, Buffer.from(p.payload)]);
        const status = parseStatus(acc);
        if (status) { mcOk = true; return finish(true, 'status-ok protocol=' + (status.version && status.version.name) + ' players=' + (status.players && status.players.online)); }
      }
    };
  });
}
const out = [];
let idx = 0;
async function worker() {
  while (idx < results.length) {
    const r = results[idx++];
    const m = await testRelay(r);
    out.push(m);
    console.log((m.mcOk ? 'MC-OK   ' : 'MC-FAIL ') + m.url + '  ' + (m.mcTarget || '') + '  ' + m.mcNote);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
out.sort((a, b) => Number(b.mcOk) - Number(a.mcOk) || a.latencyMs - b.latencyMs);
fs.writeFileSync(process.env.MC_OUTPUT || 'wisp-relays/mc-results.json', JSON.stringify(out, null, 2));
console.log('\nMC OK ' + out.filter(x => x.mcOk).length + '/' + out.length);
process.exit(0);
