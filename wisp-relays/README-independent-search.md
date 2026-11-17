# Independent relay search

Searched GitHub, MercuryWorkshop docs, Eaglercraft client lists, and public relay discussions for new independent Wisp endpoints. The exact candidates found were Eaglercraft LAN/WebRTC relays, not Wisp HTTP proxy relays.

Tested candidates:

- `wss://relay.deev.is/`
- `wss://relay.lax1dude.net/`
- `wss://relay.shhnowisnottheti.me/`
- `wss://eaglerrelay.glitch.me/`

Result: **0/4 passed** the strict Wisp HTTP-over-WebSocket check. No new independent Wisp relay was found in this search. A later source review found nine more independent endpoints; see `README-new-relays.md`. The current independent count is **53**.
