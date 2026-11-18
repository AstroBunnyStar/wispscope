# Discovery pass, 2026-11-18

Two sweeps for Wisp relays the scanner does not list, followed by the strict
probe used everywhere else in this repository.

## Result

| | |
|---|---|
| New independent relays | **4** (53 → 57) |
| New aliases | **2** |
| Scanner URLs | **460** |
| Verified pool | **1,062** |

### New independent relays

| Relay | Wisp URL | Latency | MC 25565 | Source |
|---|---|---:|---|---|
| Superuser | `wss://superuser-wisp.wasmer.app/` | 203 ms | ✅ Hypixel | wasmer deployment in a proxy bundle |
| Mistral app | `wss://symbolic-jocelyne-jxo-prod-c0e42749.apps.mistral.run/` | 239 ms | ✅ Hypixel | proxy bundle |
| OVH VPS | `wss://ns514995.ip-167-114-208.net/api` | 446 ms | ✅ Hypixel | proxy bundle |
| PGIS | `wss://pgis-wisp.getvoroa.com/` | 2898 ms | ✅ Hypixel | pgis relay page |

None shares an IPv4 address with any of the other 53 endpoints, so each is a
separate backend rather than another name for one already listed.

### New aliases

- `wss://truffled.shop/wisp/` — same IP (205.209.125.106) as `truffled.lol`
- `wss://wisp.webmc.fun/` — same operator as `wisp.webmc.xyz`

Both pass the Minecraft check, but they add no redundancy.

## Method

### Sweep 1 — relay repositories

24 GitHub repository searches (`wisp proxy`, `wisp relay`, `topic:wisp`,
platform terms), then **623** repositories downloaded as tarballs and every
`.js/.mjs/.ts/.html/.json/.md` file scanned for `wss://` literals, bundles
included. 384 endpoints were not in the 10,623 known URLs; 258 resolved; **3**
passed the strict probe, of which one was new (an alias).

### Sweep 2 — proxy-client repositories

28 different searches aimed at proxy clients, launchers and browser-OS
projects that hardcode a relay (`scramjet`, `holy unblocker`, `eaglercraft
launcher`, `browser os wisp`, …). **1,564** repositories scanned the same way,
producing 263 unseen endpoints; 134 resolved; **4** passed, all new and
independent.

### Brand sweep

Every listed operator's domain re-tested across 26 alternate TLDs with the same
hostname shape (`wisp.<domain>`), 1,266 candidates, 134 resolved, **4** passing
— two of them new aliases, two already listed.

### Hand-picked leads

12 endpoints from a 2026-11 research issue, public relay pages and a proxy
deployment guide. Both survivors (`anura.pro`, `wisp.mercurywork.shop`) were
already listed.

## On the size of the public relay pool

An unrelated audit reached a similar number from the other direction. The
`PodUtils/podssh` research (issue #175, 2026-11-09) swept Wisp servers on
2026-11-02 and recorded: *"The sweep took 76 more Wisp servers from the server
lists of web proxies on GitHub, and 53 of them answered a bare upgrade with
101."* The public Wisp population is small and grows by a few endpoints at a
time, mostly when someone deploys a new proxy with a bundled relay.

## Tooling

- `discovery/harvest.mjs` — repo search + full-tarball scan (no API token)
- `discovery/brand-sweep.mjs` — alternate-TLD sweep of listed operators
- `discovery/resolve.mjs` — DNS pre-filter
- `discovery/apply-new.mjs` — merges verified relays into the dataset
- Candidates and raw probe output: `discovery/*.json`
