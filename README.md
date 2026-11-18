# WispScope

WispScope is a static, browser-side latency checker for public [Wisp](https://github.com/MercuryWorkshop/wisp-protocol) relays. It opens real Wisp WebSockets, asks each relay to connect to `google.com:80`, sends an HTTP request, and measures the first response byte.

This is a testing tool, not a proxy. The page itself has no backend and does not route your browsing traffic.

## Live demo

[Open the WispScope scanner](https://astrobunnystar.github.io/wispscope/) — it runs entirely in your browser.

## Current data

The generated scanner contains **454 relay URLs**:

- **53 independent endpoints** in `wisp-relays/independent-53.txt`
- **401 aliases** in `wisp-relays/scanner-relays-454.json`
- **1,056 verified URLs** including the wider alias pool in `wisp-relays/verified-total.txt`
- **45 of the 53** independent endpoints also pass the Eaglercraft check (launcher Origin + Minecraft 25565) in `wisp-relays/eagler-compat.json`

Aliases are working hostnames that share a known backend or operator with another entry. They are useful as fallbacks, but they do not add independent redundancy. The discovery notes and verification results are in [`wisp-relays/README-new-relays.md`](wisp-relays/README-new-relays.md).

## Using the scanner

Open `wisp-scanner/index.html` directly, or serve the folder:

```sh
cd wisp-scanner
python -m http.server 8000
```

Then visit `http://localhost:8000/` and choose **Scan all** or **Independent**. Some relays reject requests from a foreign browser `Origin` even though they work from Node or a native Wisp client. A browser failure is therefore not always proof that a relay is dead; it can be an Origin/CORS policy.

The Node verifier is the stricter check used for the published results:

```sh
TIMEOUT=8000 CONCURRENCY=8 \
  node wisp-relays/verify-generic.mjs input.json results.json

MC_INPUT=results.json MC_OUTPUT=mc.json \
  MC_TIMEOUT=12000 MC_CONCURRENCY=4 \
  node wisp-relays/mc-test-expanded.mjs
```

An endpoint is added only after it completes the Wisp handshake, returns an actual HTTP response through `CONNECT google.com:80`, and passes a Minecraft Java status ping on port 25565.

### Eaglercraft compatibility

The launcher needs a different check than the table above: it connects from `https://astrobunnystar.github.io` and tunnels to a Minecraft server, not to `google.com:80`. Some relays accept the Wisp handshake with no `Origin` but reject the launcher's:

```sh
node wisp-relays/eagler-compat.mjs
```

It sends the Wisp handshake with `Origin: https://astrobunnystar.github.io`, then `CONNECT <minecraft-host>:25565`, and requires a parsed Minecraft status response. Every relay is classified:

- `ok` — Minecraft status received through the relay
- `mc-blocked` — Wisp works, but the Minecraft connect is refused on every target
- `origin-blocked` — upgrade refused with that Origin, accepted without it
- `wisp-fail` — upgrade accepted, Wisp handshake never completed
- `dead` — refused without the Origin too

Output goes to `wisp-relays/eagler-compat.json`, `eagler-compat-working.txt` and `eagler-compat-summary.json`. The **Use with Eaglercraft** panel in the scanner lists only `ok` relays — a relay that passes `google.com:80` but refuses Minecraft is not offered — and its **Copy** button copies the complete `play.html?wisp=…` launch link.

The relay table carries the same verdict per row, so a relay can never look launcher-ready in one place and blocked in another: `MC` for `ok`, `NO MC` for `mc-blocked`, `MC ?` when the Eaglercraft check produced no Minecraft result, and a `not in launcher · reason` line under the URL of every relay the dropdown leaves out.

After each verification run, re-apply the evidence so the dataset and the generated scanner cannot drift apart:

```sh
node wisp-relays/apply-eagler-compat.mjs
```

It rewrites the `eagler` field on independent entries from `eagler-compat.json`, removes the field from any relay without current evidence (so a relay cannot stay on offer on stale data), and regenerates `wisp-scanner/index.html` from the template. A second run prints `changed: none` and writes nothing, so the command doubles as the staleness check. Relays the evidence does not cover appear in the panel as "not yet tested".

## Adding these relays to GUST

GUST is a single-file Wisp browser by Nautilus Labs:

- Hosted SVG app: <https://cdn.jsdelivr.net/gh/nautilus-os/GUST@latest/svg/site.svg>
- Source repository: <https://github.com/nautilus-os/GUST>

GUST does **not** have a relay-list UI with unlimited entries. It supports one active Wisp server and one fallback server. You can point those two slots at any endpoints from the scanner.

The scanner includes a compact **Use with GUST** panel. It defaults to HydroVolter as the primary and Speedster as the fallback, lets you choose any of the 53 independent endpoints, and copies either URL with one click.

### Use the built-in Settings UI

1. Open the hosted GUST app.
2. Open **Settings** (the gear icon).
3. Go to **Connection → WISP Server**.
4. Paste a `wss://…` URL from `wisp-relays/independent-53.txt`, then click the checkmark to save and apply it.
5. Go to **Fallback**, enable fallback, paste a different relay into **Fallback WISP URL**, and save it.
6. Browse through GUST and check the request log. If the primary fails, GUST retries and then switches to the fallback.

For redundancy, use two independent endpoints from different operators. Do not pair a primary with an alias that points at the same backend.

The primary is stored in `localStorage` as `gust:wisp:v1`; the fallback uses `gust:fallback:wisp` and is enabled with `gust:fallback:enabled`. The settings are local to the origin where GUST is loaded.

### Change the hard-coded default (fork)

The hosted `site.svg` is only the HTML wrapper. Its relay configuration lives in `svg/static/js.js`, which `site.svg` loads relative to itself. Editing only `site.svg` will not change the default relay.

To make a relay the default in your own GUST deployment:

1. Fork `nautilus-os/GUST`.
2. Edit `svg/static/js.js`.
3. Replace the default `wss://wisp.rhw.one/wisp/` value in the `let WISP = …` initialization with your chosen relay.
4. Replace the reset default in the `wispReset` handler as well, so **Reset** returns to the same relay.
5. If you also publish the standalone `index.html` build, make the same replacement there.
6. Commit and use your fork's jsDelivr URL:

   ```text
   https://cdn.jsdelivr.net/gh/<your-user>/GUST@latest/svg/site.svg
   ```

`@latest` can be cached by jsDelivr. If the old relay still appears, purge the jsDelivr cache or pin a commit/tag instead of `@latest`.

### More than two relays

To expose a larger relay picker you would need to modify GUST's settings UI and connection code; the stock app has no array of selectable relays. A simpler workflow is to keep the two best independent relays in GUST and use this scanner to rotate them when one becomes slow or unavailable.

## Adding or updating a relay here

1. Add candidates to a JSON file as `{ "url": "wss://…" }`.
2. Run `verify-generic.mjs`.
3. Run `mc-test-expanded.mjs` on the HTTP survivors.
4. Check that the hostname is not an alias of an existing backend.
5. Add the result to `wisp-relays/scanner-relays-454.json`, then regenerate `wisp-scanner/index.html` by replacing the `__RELAY_DATA__` placeholder in `wisp-scanner/scanner.template.html` with the updated JSON.
6. Update the visible counts and the independent/verified text files.

## Safety

A Wisp relay can see the destinations you connect to and can serve or alter unencrypted traffic. Use HTTPS destinations, avoid signing into sensitive accounts through an unfamiliar public relay, and prefer relays you trust or self-host. The fact that an endpoint passes the latency test does not make it trustworthy.
