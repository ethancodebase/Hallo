# Notes

## Phase 3 — Make it secure

### Findings, ranked

| # | Severity | Issue |
|---|----------|-------|
| 1 | Critical | **Session id was both public and the only credential.** `/api/poll` handed every user's id to everyone, and every endpoint trusted whatever id the caller supplied. |
| 2 | Critical | **No server-side connection lifecycle.** `/api/signal` would deliver any type to anyone. |
| 3 | High | **Location could be triangulated.** Every re-join drew a fresh 1–3 km offset for the *same* id. |
| 4 | High | **No abuse limits.** There were no rate limits and no mailbox cap, and each signal could carry 64 KB. |
| 5 | Medium | **Missing security headers** (clickjacking, MIME sniffing, permissions). |
| 6 | Low | **Untrusted peer input.** Data-channel messages from strangers had no size limit. |
| 7 | Low | **The token appeared in the poll URL** (`?id=`), so it ended up in access logs, proxies and history. |

What #1 allowed, given only someone's public id:
- poll as them, which drained their mailbox and stole their SDP/ICE (their IP addresses) and connection requests;
- call `/api/leave` to kick them off the map;
- re-`join` as them to move their dot;
- send signals that claimed to be from them.

What #2 allowed, without any of #1:
- forge an `accept` to mark two arbitrary users permanently busy (this griefs the whole map);
- inject `offer`/`ice` into someone else's call;
- hang up calls you're not in;
- message people who never accepted (the spec says "no way to message someone before they accept").

How #1 combined with #3 became an attack: kick the victim, wait for them to auto-rejoin with a new random offset, and repeat. Averaging a few hundred positions gives the victim's real location to within metres. That defeats the core privacy requirement.

What #4 allowed: one script could flood the map with thousands of fake dots or fill a victim's mailbox (and the database).

### Fixes

- **Identity split (fixes #1 and #7).**
  - The browser generates a 256-bit secret **token** and sends it as `Authorization: Bearer` (in the body only for the `sendBeacon` leave, because beacons can't set headers).
  - The public id is `sha256("pulse:id:" + token)`, truncated to 22 base64url characters. The server derives the acting identity from the token on every call and never takes it from the body.
  - The token is never stored or returned. Knowing a public id now grants nothing (`lib/session.ts`).
- **Server-enforced state machine (fixes #2).**
  - `Presence` gains `requestTo` (the one outstanding request) and `peerId` (the active partner).
  - `accept` is only valid if the other side's `requestTo` is you and both are free. It is applied as conditional updates with rollback, so racing accepts can't double-book anyone.
  - `decline` requires a pending request.
  - `offer`/`answer`/`ice` require `peerId === toId`.
  - `end` is only allowed for your own call or request, and frees exactly that pair.
  - Leaving or being reaped now also releases the partner (`lib/connection.ts`).
- **Stable per-session offset (fixes #3).** The offset is seeded from `sha256("pulse:geo:" + token)`, so re-joining reproduces the exact same dot. A new tab means a new token, which gives a new position, as the spec requires. The radius is also now uniform over the ring area.
- **Abuse limits (fixes #4).**
  - Per-IP fixed-window rate limits on every route.
  - A recipient's mailbox is capped at 200 undrained messages.
  - Payloads are capped at 16 KB and must be a JSON object for RTC types and empty for control types.
  - `toId` must match the public-id format.
  - The poll response is capped at 1000 peers.
- **Headers (fixes #5).** `frame-ancestors 'none'` CSP plus `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (camera, microphone and geolocation for self only), HSTS and COOP.
- **Peer input (fixes #6).** Data-channel frames over 16 KB are dropped, chat is truncated to 2000 characters, and the input has a matching `maxLength`.

Verified with a scripted attack/flow test against the running API (forged accept, SDP injection, hijacked poll/leave, rejoin offset stability, rate limit): all 22 checks pass.

### Known gaps / next steps

- **The rate limiter is per serverless instance.** It slows scripted floods but isn't a global quota. Production should back it with Upstash Redis / Vercel KV, and add a Vercel WAF rule.
- **No proof-of-humanity on join.** A distributed botnet can still fill the map. Options: Turnstile on the entry gate, or proof-of-work in `join`.
- **CSP has no `script-src`.** A strict policy needs per-request nonces via `proxy.ts` (Next's inline scripts) plus Mapbox allowances (`blob:` workers, `*.mapbox.com`).
- **IP exposure to peers is inherent to STUN-only WebRTC.** Once you accept, the stranger learns your public IP. A TURN relay with `iceTransportPolicy: "relay"` would hide it; the UI should at least warn about this.
- **Busy/accept updates aren't one transaction.** Interactive transactions over a PgBouncer pooler are unreliable. Conditional `updateMany` with rollback covers the races that matter.
- **Reporting/blocking is out of scope here** (it belongs in Phase 4 "safe" territory).
