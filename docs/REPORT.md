# Pulse Technical Assessment — Status Report

**Date:** 31 October 2026
**Prepared by:** Stephanie Santos
**Repository:** `ethancodebase/Pulse-Technical-Assessment` (cloned from `PetCoverage/Pulse-Technical-Assessment`)
**Live application:** https://hallo-olive.vercel.app/

---

## 1. Executive summary

The Pulse application has been stabilised, redesigned, hardened for security and deployed to Vercel. It is ready for end-to-end testing.

- **Phase 1 (bug fixes):** I fixed six defects across presence polling, signalling, the entry flow, WebRTC and the map.
- **Phase 2 (UI):** I delivered a fantasy-themed interface: a custom globe, a "wanderers" list, an entry gate and a chat panel.
- **Phase 3 (security):** I found and fixed seven vulnerabilities, two of them critical. All 22 scripted attack and flow checks pass.
- **Deployment:** the app is live on Vercel, backed by a hosted PostgreSQL database with the Prisma migrations applied. I verified the full join, request, accept and leave flow on the production URL.

---

## 2. Deliverables

| Item | Status | Location |
|---|---|---|
| Production deployment | Live | https://hallo-olive.vercel.app/ |
| Database | Migrations applied | Neon project `winter-feather-82639128`, branch `production` |
| Bug fixes (Phase 1) | Committed | `6a07858` … `27d856c` |
| UI redesign (Phase 2) | Committed | `211eaa6` … `d7eb1c5` |
| Location privacy fix | Committed | `e41338d` |
| Security hardening (Phase 3) | Committed | `9ac79e5`, `64b82c6`, `8de8704`; write-up in `NOTES.md` |
| Neon database setup | Committed | `5c16dd4`, `9d94180` |

---

## 3. Work completed

### 3.1 Phase 1: Bug fixes

| Commit | Area | Fix |
|---|---|---|
| `6a07858` | Poll | Heartbeat refreshes only the caller; reaped sessions are reported to the client |
| `944e453` | Signal | Ending a connection frees the busy flag for **both** peers |
| `b522f6c` | Entry | Join errors are shown; added geolocation fallback, secure-context check and a `randomUUID` fallback |
| `7ac8810` | WebRTC | Fixed chat message type, ICE candidate ordering, serialized signalling, hang-up and stale-peer detection |
| `c0e4429` | Map | Removed fake Mapbox fallback token; existing markers move instead of being recreated |
| `27d856c` | Chore | Updated `package-lock.json` |

### 3.2 Phase 2: User interface

| Commit | Feature |
|---|---|
| `211eaa6` | Earth-toned vector globe with atmosphere, mist-veiled wisps, and a rune sigil marking the user's own position |
| `c66903b` | "Wanderers" ledger listing nearby users, with a whereabouts window and fly-to navigation |
| `78d97cc` | Fantasy-themed entry gate |
| `d7eb1c5` | Fantasy-styled chat panel and connection/video prompts |

### 3.3 Phase 3: Security and privacy

I ran a security review of the API and client and ranked the findings by severity. The full analysis is in `NOTES.md`.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | Critical | The public session id was also the only credential. Anyone could poll, leave, rejoin or signal as another user. | Secret 256-bit bearer token. The public id is a one-way hash of it, and the server derives identity from the token only. |
| 2 | Critical | No server-side connection lifecycle. Calls could be forged, injected or hijacked. | Server-enforced state machine (`requestTo` / `peerId`), with race-safe conditional updates. |
| 3 | High | Location could be triangulated by forcing repeated re-joins. | Offset seeded per session token, so re-joins reproduce the same dot; the offset is uniform over the 1–3 km ring. |
| 4 | High | No abuse limits (map flooding, mailbox filling). | Per-IP rate limits, 200-message mailbox cap, 16 KB payload cap, 1000-peer response cap. |
| 5 | Medium | Missing security headers. | CSP `frame-ancestors`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, COOP. |
| 6 | Low | Unbounded data from untrusted peers. | Data-channel frames over 16 KB are dropped; chat is limited to 2000 characters. |
| 7 | Low | Token sent in the poll URL (leaks into logs). | Moved to the `Authorization` header. |

**Verification:** a scripted attack and flow test against the running API covered forged accepts, SDP injection, hijacked poll/leave, rejoin offset stability and rate limiting. All 22 checks pass.

### 3.4 Database and deployment

| Step | Result |
|---|---|
| Database | Linked the Neon project with `neon init` / `neon deploy`; the pooled (`DATABASE_URL`) and direct (`DATABASE_URL_UNPOOLED`) connection strings were pulled into `.env`. |
| Schema | Ran `prisma migrate deploy`, which applied `20260608183826_initialized` and `20261031000000_connection_state`. Migrations use the direct connection; the app uses the pooled one. |
| Driver | Kept Prisma's `pg` adapter. All API routes run on the Node.js runtime, and each poll makes several queries in a row, which suits a reused pool on Neon's pooled endpoint. |
| Hosting | Deployed to Vercel at https://hallo-olive.vercel.app/ with the env vars from `.env.example`. |

---

## 4. Verification of the production deployment

These checks were run against https://hallo-olive.vercel.app/:

| Check | Result |
|---|---|
| Home page loads | 200 OK |
| Unauthenticated API call is rejected | 401 |
| User A and User B join | 200 / 200 |
| A's map shows B | Pass |
| A sends a connection request; B receives it | Pass |
| B accepts; A receives the accept | Pass |
| Both leave; their dots are removed from the map | Pass |

The same flow also passes against a local production build (`npm run build` + `next start`) connected to Neon. In that run I queried the database directly and confirmed that presence and signal rows are created during the flow and that both tables are empty after leave.

**Not yet verified:** camera, microphone and peer-to-peer video/chat. These run between browsers and can't be scripted from the server. They need a manual test with two browsers or devices.

**Privacy check:** video calls are one-on-one and peer-to-peer over WebRTC. No code records or uploads media, and the database has no place to store it. Only short-lived connection-setup messages pass through the server, and they're deleted once delivered.

---

## 5. Issues encountered and resolutions

| Issue | Impact | Resolution |
|---|---|---|
| The local database (`127.0.0.1`) can't be reached from the cloud. | No production database. | Provisioned a hosted PostgreSQL database on Neon. |
| Prisma migrations should not run through a connection pooler. | Migrations could be unreliable. | `prisma.config.ts` uses `DATABASE_URL_UNPOOLED` for migrations, falling back to `DATABASE_URL`. |

---

## 6. Deviations from requirements

- **External database:** the requirements ask for no external services. A hosted PostgreSQL database is still needed because the provided Prisma schema needs one. Only temporary coordination data is stored: presence and signalling rows that are deleted on leave or when they go stale.

---

## 7. Outstanding items and recommendations

### Action required
1. **Manual test** of video and chat between two browsers on the production URL.
2. **Phase 4** (a new "alive" or "safe" feature) has not been started.
3. **`NOTES.md`** currently covers only Phase 3; add short Phase 1, 2 and 4 sections as the README requires.

### Known limitations (from the security review)
- **Rate limiting** is per serverless instance. For a global quota, back it with Redis (e.g. Upstash).
- **No bot protection on join.** Recommend Cloudflare Turnstile or proof-of-work.
- **CSP has no `script-src` directive.** A strict policy needs per-request nonces.
- **WebRTC exposes public IPs to accepted peers** (STUN only). A TURN relay would hide them; at minimum, add a UI warning.
- **No reporting or blocking feature** (out of scope).

### Operational notes
- **Environment variables:** set `DATABASE_URL` (pooled) and `NEXT_PUBLIC_MAPBOX_TOKEN` in the Vercel project settings; `DATABASE_URL_UNPOOLED` is only needed where migrations run.
- **Schema changes:** run `npx prisma migrate deploy` with the direct connection string, then redeploy on Vercel.
