# 31 verified public Wisp relays

Verified on **2026-11-09** from this machine. Every endpoint below completed a real Wisp TCP relay test:

1. Open the Wisp WebSocket.
2. Complete the Wisp v1/v2 handshake.
3. Send a Wisp `CONNECT` to `google.com:80`.
4. Send `GET / HTTP/1.1`.
5. Require an actual `HTTP/` response (not just an open WebSocket).

All 31 passed the strict HTTP test; **27/31** also returned a valid Minecraft Java status response on port 25565, which is the useful test for Eaglercraft/Wispcraft.

Latency is time to the first HTTP response byte from this machine. It will vary from your location.

## Relays

| # | Name | Wisp URL | HTTP latency | MC 25565 |
|---:|---|---|---:|---|
| 1 | MyProxy | `wss://myproxy-zeta.vercel.app/wisp/` | 286 ms | ✅ |
| 2 | Motor Cycle Part | `wss://motor-cycle-part.org/wisp/` | 345 ms | ✅ |
| 3 | bare-server (Fly.io) | `wss://bare-server.fly.dev/wisp/` | 372 ms | ✅ |
| 4 | Fern | `wss://fern.best/wisp/` | 379 ms | ✅ |
| 5 | vibeOS | `wss://vibeos.sh/api/wisp/` | 407 ms | ❌ |
| 6 | Anjomous Wisp Worker | `wss://wisp.anjomous.workers.dev/` | 423 ms | ✅ |
| 7 | OrbitWeb | `wss://orbitweb.org/campus/` | 476 ms | ✅ |
| 8 | TerbiumOS | `wss://wisp.terbiumon.top/wisp/` | 487 ms | ✅ |
| 9 | InvisiProxy | `wss://invisiproxy.com/wisp/` | 516 ms | ❌ |
| 10 | DefinitelyScience | `wss://definitelyscience.com/wisp/` | 539 ms | ✅ |
| 11 | Lichology | `wss://lichology.com/wisp/` | 540 ms | ✅ |
| 12 | Supabase proxy-wisp | `wss://dkwmkvruzebnqlmvwzhy.supabase.co/functions/v1/proxy-wisp/` | 559 ms | ❌ |
| 13 | Mages | `wss://mages.io/wisp/` | 571 ms | ✅ |
| 14 | GoInterstellar | `wss://gointospace.app/wisp/` | 591 ms | ✅ |
| 15 | Zakaon | `wss://zakaon.top/wisp/` | 655 ms | ✅ |
| 16 | Vela Wisp (Render) | `wss://vela-wisp.onrender.com/` | 708 ms | ✅ |
| 17 | Shasta | `wss://shasta-dtg.pages.dev/wisp/` | 784 ms | ✅ |
| 18 | Tinf0il | `wss://tinf0il.site/wisp/` | 788 ms | ✅ |
| 19 | yashsurjuse HuggingFace | `wss://yashsurjuse-wisp.hf.space/` | 790 ms | ✅ |
| 20 | Liventcord (Koyeb) | `wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/wisp/` | 796 ms | ✅ |
| 21 | purnhab68 HuggingFace | `wss://purnhab68-gitea.hf.space/` | 829 ms | ✅ |
| 22 | FreeWisp | `wss://wisp.freewisp.org/` | 1026 ms | ❌ |
| 23 | WebMC | `wss://wisp.webmc.xyz/` | 1130 ms | ✅ |
| 24 | Mercury Workshop | `wss://wisp.mercurywork.shop/` | 1152 ms | ✅ |
| 25 | AnuraOS | `wss://anura.pro/` | 1161 ms | ✅ |
| 26 | Fracital holyWisp | `wss://holywisp.fracit.al/` | 1213 ms | ✅ |
| 27 | BrowserJS (Railway) | `wss://browserjs-production.up.railway.app/wisp/` | 1243 ms | ✅ |
| 28 | Smartfoloo arsenic | `wss://arsenic.smartfoloo.space/wisp/` | 1311 ms | ✅ |
| 29 | Smartfoloo chat | `wss://chat.smartfoloo.space/wisp/` | 1341 ms | ✅ |
| 30 | Tokyo new-updates | `wss://tokyo.new-updates.info/wisp/` | 1449 ms | ✅ |
| 31 | MEX UBG (Render) | `wss://mex-ubg-wisp.onrender.com/wisp/` | 10532 ms | ✅ |

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

- **MyProxy** — `wss://myproxy-zeta.vercel.app/api/wisp/`
- **Fern** — `wss://fern.best/wisp`
- **vibeOS** — `wss://vibeos.sh/api/wisp`
- **Anjomous Wisp Worker** — `wss://wisp.anjomous.workers.dev/wisp/`
- **GoInterstellar** — `wss://*.links.gointospace.app/wisp/ (wildcard, same backend)`
- **Vela Wisp (Render)** — `wss://vela-wisp.onrender.com/wisp/`
- **yashsurjuse HuggingFace** — `wss://yashsurjuse-wisp.hf.space/wisp/`
- **Liventcord (Koyeb)** — `wss://hurt-agata-liventcord-api-7072e9a6.koyeb.app/`
- **purnhab68 HuggingFace** — `wss://purnhab68-gitea.hf.space/wisp/`
- **FreeWisp** — `wss://freewisp.org/`, `wss://wisp.freewisp.org/wisp/`
- **WebMC** — `wss://wisp.webmc.xyz/wisp/`
- **Mercury Workshop** — `wss://wisp.mercurywork.shop/wisp/`, `wss://wisp.mercurywork.shop/v86/`
- **AnuraOS** — `wss://anura.pro/wisp/`

The wildcard form `wss://*.links.gointospace.app/wisp/` resolves to the same backend as `wss://gointospace.app/wisp/`. Path aliases such as `/wisp/` on the same host are the same relay, not an extra server.

## Caveats

- These are free/public relays with no SLA. They can disappear, rate-limit, or change policy at any time.
- Latency was measured from one Windows machine; your results will differ.
- Some hosts are frontends that may forward to another upstream (notably Shasta and MyProxy). They are listed as distinct working URLs, but independent-operator count is not guaranteed.
- `wisp.anjomous.workers.dev` blocks `example.com` specifically (Wisp close reason 0x42) but works for Google and Minecraft; that is a host policy, not a broken relay.
- `wss://vibeos.sh/api/wisp/`, `wss://invisiproxy.com/wisp/`, `wss://dkwmkvruzebnqlmvwzhy.supabase.co/functions/v1/proxy-wisp/`, `wss://wisp.freewisp.org/` failed all three Minecraft 25565 targets. They remain valid HTTP-over-Wisp relays.

## Failed at test time (not included)

`wisp.rhw.one`, `glseries.net`, `relay.widgetry.org`, `wisp.mercuryworkshop.xyz`, `pgis-wisp.joytree.site`, `wisp.nova0.lol`, `wisp.boety.fun` (auth wall), `nebulaproxy.io`, `area.forwardersoft.com`, `truf.the-nest.at`, `thoughts.forwardersoft.com`, and `english.algebra.teacher.vocabulary.homework.forwardersoft.com`.

## Files

- `working.txt` — one copy-paste URL per line.
- `working.json` — full results, aliases, latency, and Minecraft status.
- `verify-final.mjs` / `mc-test.mjs` — the test scripts used.
