# 10 new independent Wisp relays

Found and verified on **2026-11-14** with the same strict test:

1. Open the Wisp WebSocket.
2. Complete the Wisp v1/v2 handshake.
3. Send a Wisp `CONNECT` to `google.com:80`.
4. Send `GET / HTTP/1.1`.
5. Require an actual `HTTP/` response.

The endpoints below also passed a real Minecraft Java status ping on port 25565.

| Relay | Wisp URL | HTTP latency | MC 25565 |
|---|---|---:|---|
| q13x US East | `wss://us-east.wisp.q13x.com/` | 283 ms | ✅ |
| q13x SE Asia | `wss://se-asia.wisp.q13x.com/` | 1719 ms | ✅ |
| Spark Frankfurt | `wss://fra-wisp-node.sparkpowered.org/` | 780 ms | ✅ |
| Spark Kansas City | `wss://mci-wisp-node.sparkpowered.org/` | 915 ms | ✅ |
| Spark Singapore | `wss://sin-wisp-node.sparkpowered.org/` | 1119 ms | ✅ |
| Spark Tokyo | `wss://nrt-wisp-node.sparkpowered.org/` | 1231 ms | ✅ |

## Sources

- q13x’s public Wisp backend: `WorldEditAxe/wisp-docker`, whose Wispcraft default is `wss://us-east.wisp.q13x.com/`. The other q13x region names came from the certificate SANs for `wisp.q13x.com`.
- Spark’s Wisp nodes are defined in `WorldEditAxe/webshell` at `src/lib/wisp.ts`.

## Not included

The q13x region names `us-west.wisp.q13x.com` and `eu-central.wisp.q13x.com` resolved but closed with Wisp reason 66 during this test, so they are not counted as working. `wss://wisp.q13x.com/` also failed.

## 3 more independent relays (2026-11-14)

These were found in a later GitHub issue and documentation search and passed the same strict HTTP and Minecraft tests.

| Relay | Wisp URL | HTTP latency | MC 25565 |
|---|---|---:|---|
| LinuxOnTab | `wss://linuxontab-net.fly.dev/wisp` | 321 ms | ✅ |
| Zodiac | `wss://zodiac.icu/wisp/` | 448 ms | ✅ |
| Lunaar | `wss://lunaar.org/wisp/` | 711 ms | ✅ |

Sources: LinuxOnTab’s default relay is named in `kilian-ai/linuxontab` issue #17; Zodiac is the default Wisp server in `Darkdragonzxs/sandstone`; Lunaar exposes the endpoint in its own proxy bundle and documentation.

## 1 more independent relay (2026-11-14)

Found by scraping generic proxy deployments and their service-worker/config bundles, then passing the same HTTP and Minecraft tests.

| Relay | Wisp URL | HTTP latency | MC 25565 |
|---|---|---:|---|
| HydroVolter Proxy | `wss://admin.proxy.hydrovolter.com/wisp/` | 195 ms | ✅ |

`health.acne-support.info` also passed both tests, but it resolves to the same origin as the existing `arsenic.smartfoloo.space` and `chat.smartfoloo.space` relays; it is an alias and is not counted here.

## 2 more verified relays (2026-11-14)

Found by scraping the service-worker/config bundles of newly created proxy repositories, then passing the same strict HTTP and Minecraft tests.

| Relay | Wisp URL | HTTP latency | MC 25565 | Group |
|---|---|---:|---:|---|
| Speedster | `wss://speedster.heavengtwashere.workers.dev/wisp/` | 445 ms | ✅ CubeCraft | independent |
| STOMP / Fracital | `wss://stomp.fracit.al/pipe/47ca81407404a186be5266a34fc90bf7/` | 281 ms | ✅ Hypixel | alias |

Speedster is a distinct Cloudflare Worker. STOMP is a separate working endpoint on the existing `fracit.al` operator domain as `holywisp.fracit.al`, so it is counted as an alias rather than padding the independent total.

## 1 more independent relay (2026-11-17)

Found by mining the GitHub code-search hits for `"wss://" "wisp"`. `esimeon-oss/Safari` uses this Fly.io app as its `DEFAULT_UPSTREAM` in `functions/wisp/[[path]].js`.

| Relay | Wisp URL | HTTP latency | MC 25565 |
|---|---|---:|---|
| Safari Wisp (Fly) | `wss://app-dry-waterfall-5636.fly.dev/wisp/` | 331 ms | ✅ |

It is a distinct Fly.io app from the existing `bare-server.fly.dev` and `linuxontab-net.fly.dev` relays, so it is counted as independent.

## Counts after this addition

- **53** independent endpoints.
- **401** aliases.
- **454** scanner URLs total.
- **1,056** verified URLs including the separate alias pool.

## Caveat

Spark’s four regional hostnames share a DNS/Cloudflare front and operator; q13x’s regions also share an operator. They are distinct working endpoints, but not four separate companies. The browser scanner’s “Independent” group means a distinct endpoint/backend, not verified operator independence. Endpoints on a known shared operator domain, such as STOMP on `fracit.al`, remain aliases even when the path differs.
