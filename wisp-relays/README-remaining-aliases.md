# Remaining gointospace aliases

The remaining pool was **1,223 unique aliases** after excluding URLs already in `verified-441.txt`. Each was tested with the same strict Wisp handshake → `CONNECT google.com:80` → HTTP GET check.

## Result

- **602 working** — written to `remaining-aliases-working.txt`.
- **621 failed**.
- Total verified URL count is now **1043**.

### Failure reasons

- close-reason:73: 586
- closed:1006: 35

## Caveat

Every URL in this batch is a **gointospace alias**. These are additional hostnames for the same backend, not independent relays. This batch does not add independent relays. After the later additions in `README-new-relays.md`, the current independent count is **51**.

## Files

- `remaining-aliases-working.txt` — 602 working URLs.
- `remaining-aliases-working.json` — working results with latency and source.
- `remaining-aliases-results.json` — all 1,223 results.
- `verified-total.txt` — all 1043 verified URLs.
