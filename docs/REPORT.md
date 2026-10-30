# Pulse Technical Assessment — Status Report

**Date:** 31 October 2026
**Prepared by:** Stephanie Santos
**Repository:** `ethancodebase/Pulse-Technical-Assessment` (forked from `PetCoverage/Pulse-Technical-Assessment`)
**Live application:** https://pulse-assessment-2374.netlify.app

---

## 1. Executive summary

The Pulse application has been stabilised, redesigned, hardened for security and deployed to production. It is ready for end-to-end testing.

- **Phase 1 (bug fixes):** I fixed six defects across presence polling, signalling, the entry flow, WebRTC and the map.
- **Phase 2 (UI):** I delivered a fantasy-themed interface: a custom globe, a "wanderers" list, an entry gate and a chat panel.
- **Phase 3 (security):** I found and fixed seven vulnerabilities, two of them critical. All 22 scripted attack and flow checks pass.
- **Deployment:** the app is live on Netlify, backed by a dedicated Supabase PostgreSQL database with the Prisma schema applied. I verified the full join, request, accept and leave flow on the production URL.

**Action required:** the Phase 3 security changes and the deployment configuration are live but not yet committed to git (see section 7).

---

## 2. Deliverables

| Item | Status | Location |
|---|---|---|
| Production deployment | Live | https://pulse-assessment-2374.netlify.app |
| Production database | Live, migrations applied | Supabase project `pulse` (US East) |
| Bug fixes (Phase 1) | Committed | `6a07858` … `27d856c` |
| UI redesign (Phase 2) | Committed | `211eaa6` … `d7eb1c5` |
| Location privacy fix | Committed | `e41338d` |
| Security hardening (Phase 3) | Done, **uncommitted** | working tree; write-up in `NOTES.md` |
| Deployment config | Done, **uncommitted** | `netlify.toml`, `.gitignore` |

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
| 3 | High | Location could be triangulated by forcing repeated re-joins. | Offset seeded per session token, so re-joins reproduce the same dot; the offset is uniform over the 1–3 km ring (commit `e41338d`). |
| 4 | High | No abuse limits (map flooding, mailbox filling). | Per-IP rate limits, 200-message mailbox cap, 16 KB payload cap, 1000-peer response cap. |
| 5 | Medium | Missing security headers. | CSP `frame-ancestors`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, COOP. |
| 6 | Low | Unbounded data from untrusted peers. | Data-channel frames over 16 KB are dropped; chat is limited to 2000 characters. |
| 7 | Low | Token sent in the poll URL (leaks into logs). | Moved to the `Authorization` header. |

**Verification:** a scripted attack and flow test against the running API covered forged accepts, SDP injection, hijacked poll/leave, rejoin offset stability and rate limiting. All 22 checks pass.

### 3.4 Deployment

| Step | Result |
|---|---|
| Database | Created a dedicated Supabase PostgreSQL project, `pulse` (US East). |
| Schema | Ran `prisma migrate deploy`, which applied `20260608183826_initialized` and `20261031000000_connection_state`. |
| Hosting | Created Netlify site `pulse-assessment-2374`. |
| Environment variables | Set both variables from `.env.example`: `DATABASE_URL` (secret, via the Supabase transaction pooler) and `NEXT_PUBLIC_MAPBOX_TOKEN`. |
| Access | Turned off the team's default login protection so reviewers can open the site. |
| Build config | Added `netlify.toml`. |

---

## 4. Verification of the production deployment

These checks were run against https://pulse-assessment-2374.netlify.app:

| Check | Result |
|---|---|
| Home page loads | 200 OK, title "Pulse" |
| User A and User B join | 200; each receives a public id |
| A's map shows B | Pass |
| A sends a connection request; B receives it | Pass |
| B accepts; A receives the accept | Pass |
| Both leave; map is empty | Pass |
| Mapbox token accepted from the production domain | 200 OK |

**Not yet verified:** camera, microphone and peer-to-peer video/chat. These run between browsers and can't be scripted from the server. They need a manual test with two browsers or devices.

---

## 5. Issues encountered and resolutions

| Issue | Impact | Resolution |
|---|---|---|
| Vercel CLI login could not be completed (two device codes expired). | Vercel deployment blocked. | Deployed to Netlify instead, as directed. |
| The local database (`127.0.0.1`) can't be reached from the cloud. | No production database. | Provisioned Supabase. |
| The `pg` driver rejected Supabase's TLS certificate chain under `sslmode=require`. | Database connections failed. | Added `uselibpqcompat=true`; the connection stays encrypted. |
| Netlify team SSO protection returned 401 to all visitors. | Reviewers couldn't open the site. | Turned off SSO protection for this site. |
| API routes returned 500: `Cannot find module '@prisma/client-…'`. | All database-backed features broken. | Turbopack loads Prisma through a symlinked alias that Netlify's bundler dropped (the build ran on Windows). The Netlify build now uses `next build --webpack`; local builds are unchanged. |

---

## 6. Deviations from requirements

- **Hosting platform:** the requirements specify Vercel. The app was deployed to Netlify after the Vercel login couldn't be completed. The codebase remains Vercel-compatible: no Netlify-specific code was added beyond `netlify.toml`.
- **External database:** the requirements ask for no external services. A hosted PostgreSQL database (Supabase) is still needed because the provided Prisma schema needs one. Only temporary coordination data is stored: presence and signalling rows that are deleted on leave or when they go stale.

---

## 7. Outstanding items and recommendations

### Action required
1. **Commit and push the uncommitted work:**
   - the Phase 3 security changes (API routes, `lib/session.ts`, `lib/rateLimit.ts`, `lib/connection.ts`, the schema and migration)
   - `NOTES.md`
   - `netlify.toml`
   - the `.gitignore` update
2. **Manual test** of video and chat between two browsers on the production URL.

### Known limitations (from the security review)
- **Rate limiting** is per serverless instance. For a global quota, back it with Redis (e.g. Upstash).
- **No bot protection on join.** Recommend Cloudflare Turnstile or proof-of-work.
- **CSP has no `script-src` directive.** A strict policy needs per-request nonces.
- **WebRTC exposes public IPs to accepted peers** (STUN only). A TURN relay would hide them; at minimum, add a UI warning.
- **No reporting or blocking feature** (out of scope).

### Operational notes
- **Database credential:** the password exists only in Netlify's `DATABASE_URL` secret. To rotate it, reset it in Supabase (Project Settings → Database) and update the Netlify variable.
- **Redeploy:** run `netlify deploy --prod --build` from the project root.
