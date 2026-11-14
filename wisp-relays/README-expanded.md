> Historical: this document describes the 41-relay / 241-URL set from 2026-11-09. The current scanner has 47 independent endpoints + 400 aliases (447 URLs); see `README-new-relays.md` for the six later additions.

# 41 independent Wisp relays + 200 verified gateway URLs

Verified on **2026-11-09** from this machine. Every URL completed a real Wisp TCP relay test:

1. Open the Wisp WebSocket.
2. Complete the Wisp v1/v2 handshake.
3. Send a Wisp `CONNECT` to `google.com:80`.
4. Send `GET / HTTP/1.1`.
5. Require an actual `HTTP/` response, not just an open WebSocket.

## Read this first

I could **not** find 200 additional *independent* public Wisp relays. The public Wisp ecosystem does not appear to have that many live, independent servers. What I did verify is:

- **41 independent endpoints** — 31 previously delivered plus **10 new** ones.
- **200 additional working URLs** — but all 200 are gateway aliases of **one** backend: `gointospace.app`.
- **241 unique verified URLs total.**

The 200 aliases are useful as a large list of working URLs, but they are **not 200 independent relays**. If `gointospace.app` goes down, all 200 aliases fail together. Do not treat the 200 as redundancy.

## Independent relays (41)

Table columns: latency is time to the first HTTP response byte from this machine; MC is a real Java status ping on port 25565 against Hypixel, then CubeCraft, then Origin Realms.

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
| 32 | Truffled | `wss://truffled.lol/wisp/` | 291 ms | ✅ |
| 33 | DaydreamX | `wss://daydreamx.pro/wisp/` | 298 ms | ✅ |
| 34 | Study Work and More | `wss://studyworkandmore.uk/wisp/` | 307 ms | ✅ |
| 35 | 51.222.206.184 backend | `wss://xh4r26oz8gg460od.oid76seqraqkbvwx.mvd.hi.stack.ddnsfree.com/wisp/` | 318 ms | ✅ |
| 36 | Civil Quartinal | `wss://civil.quartinal.me/wisp/` | 447 ms | ✅ |
| 37 | Petezah Games | `wss://petezahgames.com/wisp/` | 549 ms | ✅ |
| 38 | 15.204.116.230 backend | `wss://15.204.116.230.sslip.io/wisp/` | 565 ms | ✅ |
| 39 | Achromaon | `wss://achromaon.top/wisp/` | 580 ms | ✅ |
| 40 | EduShasta | `wss://edushasta.lol/wisp/` | 666 ms | ✅ |
| 41 | Aetheris | `wss://aetheris.win/wisp/` | 749 ms | ✅ |

**37/41** independent endpoints passed the Minecraft 25565 test. ❌ means all three MC targets failed; the relay still passed strict HTTP-over-Wisp and may work for browsing or another Minecraft server.

## The 200 additional URLs

All of these are verified `wss://*.links.gointospace.app/wisp/` gateway aliases:

- File: `additional-200-aliases.txt` (exactly 200 lines).
- Full verification data: `additional-200-results.json` (200/200 HTTP-over-Wisp).
- Same backend as `wss://gointospace.app/wisp/`; that backend also passed Minecraft 25565.

Sample:

- `wss://api.hfhj.links.gointospace.app/wisp/`
- `wss://9does-no-exist33.wwwghfchujedujhbhre.links.gointospace.app/wisp/`
- `wss://6update.ikgqcgxpipen.anything.links.gointospace.app/wisp/`
- `wss://api.first.links.gointospace.app/wisp/`
- `wss://api.exist33.ghfchujedujhbhre.links.gointospace.app/wisp/`
- `wss://api.hfhdgsvdhsbsfjbfbfhdvd.links.gointospace.app/wisp/`
- `wss://api.does-no-exist33.dev.eeeehgvjf.links.gointospace.app/wisp/`
- `wss://api.does-no-exist33.wwwwww.www.ghfchujedujhbhre.links.gointospace.app/wisp/`

The complete list is in `additional-200-aliases.txt`. Do not count these as independent relays.

## Using them

### Eaglercraft / Wispcraft

These are **Wisp relays**, not Eaglercraft game servers. Vanilla Eaglercraft does not use Wisp; use **Wispcraft** or another Wisp-capable client. Paste the Wisp URL into the relay field, then connect to the Java server address.

### Penumbra / other Wisp browsers

Paste the URL into the browser's Wisp server field. HTTPS sites need outbound port 443; these were verified on port 80, and 37/41 independent endpoints also answered on 25565. Outbound policy can still differ by destination.

### General

- Keep the trailing slash exactly as shown.
- Prefer the 41 independent endpoints for reliability; use the 200 aliases only as extra URL options.
- Free/public relays have no SLA and can disappear or rate-limit at any time.
- All tested endpoints negotiated **Wisp v1**. Servers advertising v2 also accepted v1.

## Verification caveats

- Independent count is by distinct hostname/backend, not by path. Path aliases on the same host are not counted separately.
- A few frontends may forward to the same upstream (notably Shasta and EduShasta); the list is distinct working URLs, but independent-operator count is not guaranteed.
- Latency was measured from one Windows machine and will vary.
- `wss://wisp.anjomous.workers.dev/` blocks `example.com` specifically but works for Google and Minecraft.
- The 200 gateway aliases all share one backend, so they add URL count, not redundancy.

## Files

- `independent-41.txt` — the 41 independent URLs, one per line.
- `additional-200-aliases.txt` — the 200 gateway aliases, one per line.
- `verified-241.txt` — all 241 unique URLs.
- `working-expanded.json` — structured data, latencies, MC results, and the shared-backend warning.
- `additional-200-results.json` / `independent-additions-results.json` — raw verification results.
- `verify.mjs` / `mc-test-expanded.mjs` — test scripts.
