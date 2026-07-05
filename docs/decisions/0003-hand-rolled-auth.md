# ADR 0003 — Hand-rolled single-owner auth

**Status:** Accepted · 2026-07

## Context

The app is reachable on the public internet and needs a gate, but it's single-owner — no user
table, no per-row scoping. The plan floated hand-rolled login vs. Cloudflare Access.

## Decision

Hand-rolled login with a signed session cookie.

- One secret **`APP_PASSPHRASE`** is the app password (`.dev.vars` locally, `wrangler secret put`
  in prod). Login compares the submitted passphrase in constant time.
- Session is a stateless, HMAC-SHA256-signed cookie (`imgthing_session`), signed with
  **`SESSION_SECRET`** via Web Crypto. Payload `{ sub: "owner", exp }`, 30-day expiry, `httpOnly`,
  `sameSite=lax`, `secure` in prod. No sessions table.
- Two guards: `server/middleware/auth.ts` returns 401 for any `/api/**` except `/api/auth/*` and
  `/api/health`; `app/middleware/auth.global.ts` redirects unauthenticated page loads to `/login`.
- Routes: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`.

### Why not Cloudflare Access

Access is excellent but couples auth to the Zero Trust dashboard config and doesn't work in local
dev without stubbing. Hand-rolled keeps the app self-contained, portable, and testable in local
dev with no Cloudflare account. The cost is small (one util + two guards + a login page).

## Consequences

- Secrets must be set in prod before deploy (see `../cloudflare-setup.md` step 5).
- Stateless cookie = no server-side revocation; rotating `SESSION_SECRET` invalidates all sessions.
- If multi-device or per-device revocation is ever needed, add a lightweight `sessions` table
  (supersede this ADR).
