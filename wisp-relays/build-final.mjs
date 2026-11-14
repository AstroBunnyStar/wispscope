import fs from 'node:fs';
const final = JSON.parse(fs.readFileSync('wisp-relays/final-results.json', 'utf8')).filter(r => r.ok);
const mc = JSON.parse(fs.readFileSync('wisp-relays/mc-results.json', 'utf8'));
const mcMap = new Map(mc.map(x => [x.url, x]));
const relays = final.map(r => {
  const m = mcMap.get(r.url) || {};
  const statusMatch = (r.firstLine || '').match(/HTTP\/\d\.\d\s+(\d{3})/);
  return {
    url: r.url,
    name: r.name,
    protocol: 'v' + (r.version || 1),
    httpStatus: statusMatch ? Number(statusMatch[1]) : null,
    latencyMs: r.latencyMs,
    minecraft: { ok: Boolean(m.mcOk), target: m.mcTarget || null, note: m.mcNote || null },
    aliases: r.aliases || []
  };
}).sort((a, b) => a.latencyMs - b.latencyMs);
const mcOk = relays.filter(r => r.minecraft.ok).length;
const now = new Date().toISOString();
const payload = {
  generatedAt: now,
  verifiedAt: '2026-11-09',
  count: relays.length,
  minecraftOk: mcOk,
  test: {
    transport: 'Wisp over WebSocket',
    target: 'google.com:80',
    request: 'GET / HTTP/1.1',
    success: 'HTTP/ response received through the relay',
    minecraft: 'Java status ping on port 25565 (Hypixel, then CubeCraft, then Origin Realms)'
  },
  relays
};
fs.writeFileSync('wisp-relays/working.json', JSON.stringify(payload, null, 2));
fs.writeFileSync('wisp-relays/working.txt', relays.map(r => r.url).join('\n') + '\n');
const rows = relays.map((r, i) => `| ${i + 1} | ${r.name} | \`${r.url}\` | ${r.latencyMs} ms | ${r.minecraft.ok ? '✅' : '❌'} |`).join('\n');
const aliases = relays.filter(r => r.aliases.length).map(r => `- **${r.name}** — ${r.aliases.map(a => '`' + a + '`').join(', ')}`).join('\n');
const mcFails = relays.filter(r => !r.minecraft.ok).map(r => '`' + r.url + '`').join(', ');
const readme = `# ${relays.length} verified public Wisp relays

Verified on **2026-11-09** from this machine. Every endpoint below completed a real Wisp TCP relay test:

1. Open the Wisp WebSocket.
2. Complete the Wisp v1/v2 handshake.
3. Send a Wisp \`CONNECT\` to \`google.com:80\`.
4. Send \`GET / HTTP/1.1\`.
5. Require an actual \`HTTP/\` response (not just an open WebSocket).

All ${relays.length} passed the strict HTTP test; **${mcOk}/${relays.length}** also returned a valid Minecraft Java status response on port 25565, which is the useful test for Eaglercraft/Wispcraft.

Latency is time to the first HTTP response byte from this machine. It will vary from your location.

## Relays

| # | Name | Wisp URL | HTTP latency | MC 25565 |
|---:|---|---|---:|---|
${rows}

✅ = a real Minecraft status JSON came back on 25565. ❌ = all three test targets failed; the relay still passed the HTTP test and may still work for browsing or a different Minecraft server.

## Using them

### Eaglercraft / Wispcraft

These are **Wisp** relays, not Eaglercraft game servers. Vanilla Eaglercraft does not use Wisp; use them with **Wispcraft** (or another Wisp-capable client) to reach Java Edition servers. In Wispcraft, paste the Wisp URL into its relay/server field, then connect to the Java server's address.

### Penumbra / other Wisp browsers

Paste the URL into the browser's Wisp server field. HTTPS sites need the relay to allow outbound port 443; these relays were verified on port 80 and 27 of them also on 25565, but outbound policy can differ by destination.

### General

- Keep the trailing slash exactly as shown where present.
- If one relay is slow or blocked, try another; this is a pool, not a single service.
- All of these negotiated **Wisp v1** in testing. Servers that advertise v2 also accepted v1.

## Aliases (not counted separately)

${aliases}

The wildcard form \`wss://*.links.gointospace.app/wisp/\` resolves to the same backend as \`wss://gointospace.app/wisp/\`. Path aliases such as \`/wisp/\` on the same host are the same relay, not an extra server.

## Caveats

- These are free/public relays with no SLA. They can disappear, rate-limit, or change policy at any time.
- Latency was measured from one Windows machine; your results will differ.
- Some hosts are frontends that may forward to another upstream (notably Shasta and MyProxy). They are listed as distinct working URLs, but independent-operator count is not guaranteed.
- \`wisp.anjomous.workers.dev\` blocks \`example.com\` specifically (Wisp close reason 0x42) but works for Google and Minecraft; that is a host policy, not a broken relay.
- ${mcFails || 'No relays failed the Minecraft test.'} failed all three Minecraft 25565 targets. They remain valid HTTP-over-Wisp relays.

## Failed at test time (not included)

\`wisp.rhw.one\`, \`glseries.net\`, \`relay.widgetry.org\`, \`wisp.mercuryworkshop.xyz\`, \`pgis-wisp.joytree.site\`, \`wisp.nova0.lol\`, \`wisp.boety.fun\` (auth wall), \`nebulaproxy.io\`, \`area.forwardersoft.com\`, \`truf.the-nest.at\`, \`thoughts.forwardersoft.com\`, and \`english.algebra.teacher.vocabulary.homework.forwardersoft.com\`.

## Files

- \`working.txt\` — one copy-paste URL per line.
- \`working.json\` — full results, aliases, latency, and Minecraft status.
- \`verify-final.mjs\` / \`mc-test.mjs\` — the test scripts used.
`;
fs.writeFileSync('wisp-relays/README.md', readme);
console.log('WROTE ' + relays.length + ' relays, MC OK ' + mcOk);
console.log('FIRST 5:');
for (const r of relays.slice(0, 5)) console.log(r.url + '  ' + r.latencyMs + 'ms  mc=' + r.minecraft.ok);
