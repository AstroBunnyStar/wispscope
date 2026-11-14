# 200 additional verified Wisp URLs

Verified on **2026-11-09** from this machine with the same strict HTTP-over-Wisp test used for the original list:

1. Open the Wisp WebSocket.
2. Complete the Wisp v1/v2 handshake.
3. Send a Wisp `CONNECT` to `google.com:80`.
4. Send `GET / HTTP/1.1`.
5. Require an actual `HTTP/` response, not just an open WebSocket.

## Counts

- **200** new unique URLs, none of which are in the previous `verified-241.txt`.
- **441** total unique verified URLs now.
- **270** candidates passed this fresh verification; the first 200 were selected.

### Selected by source

- urlscan: **80**
- gointospace: **76**
- gointospace-new: **42**
- sweep: **2**

### Approximate backend groups

- 15.204.116.230: **65**
- 51.222.206.184: **5**
- other URLScan alias: **12**
- gointospace.app: **118**

## Important caveat

These are **not 200 independent relays**. They are additional working URLs, mostly aliases of the gointospace backend plus the 15.204 / 51.222 backends found through URLScan. If those backends go down, all aliases pointing at them go down together. The 41 independent endpoints remain the actual redundancy pool.

## Files

- `additional-200-more.txt` — exactly 200 new URLs, one per line.
- `additional-200-more-selected.json` — selected results with source, host, and latency.
- `additional-200-more-results.json` — fresh verification results for all candidates.
- `verified-441.txt` — the previous 241 plus these 200 (441 unique URLs).
- `additional-200-more.log` — verification output.

## Scanner note

The browser scanner at `wisp-scanner/index.html` now contains 451 URLs: the original 441 plus ten new independent relays. The 602 later gointospace aliases remain in a separate file and are not in the scanner.
