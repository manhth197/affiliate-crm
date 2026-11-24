# 002 — API: access JWT + rotating opaque refresh tokens

## Context
The contract fixes a 15-minute access token and a 7-day refresh token sent in the body of `/auth/refresh`, rotated on every use. The web app keeps the access token in memory. We need to revoke sessions (logout, disabled user, stolen token) without a DB lookup on every request.

## Decision
- **Access token:** HS256 JWT, 15 min, claims `{ sub, role }` only (no PII). Checked statelessly by a global `JwtAuthGuard`; routes opt out with `@Public()` (secure by default). A global `RolesGuard` enforces `@Roles(...)`.
- **Refresh token:** 256-bit random opaque string, not a JWT. Only its SHA-256 hash is stored (`refresh_tokens.token_hash`, unique index). A fast hash is enough because the input is random, and it allows lookup by index.
- **Rotation with reuse detection:** each refresh revokes the presented token and issues a new one in the same `familyId` (one family = one login session). If an already-rotated token is presented again, it was probably stolen, so the whole family is revoked. A conditional `UPDATE … WHERE revoked_at IS NULL` inside a transaction makes concurrent refreshes safe: only one wins.
- **Passwords:** argon2id (library defaults: 64 MiB, 3 iterations). Login runs a dummy verify for unknown emails so timing does not reveal registered emails; the message is the same for both cases.
- **Disabled users:** refused at login and refresh (403). An already-issued access token stays valid until it expires (≤ 15 min).
- **Rate limit:** `@nestjs/throttler` on `/auth/*` (default 10 requests/min per IP, `/auth/me` excluded).

## Alternatives
- Refresh token as a JWT: self-contained but still needs a DB record to revoke, so no real gain.
- Checking the user in the DB on every request: instant revocation, but one extra query per call. 15 minutes of exposure is the accepted trade-off.
- bcrypt: fine, but truncates at 72 bytes and is not memory-hard.
- Refresh token in an HttpOnly cookie: safer against XSS, but the contract specified the body. Adopted in contract v0.6, see decision 009.

## Consequences
- The web client must serialise refreshes (one in-flight refresh shared by all requests); two parallel refreshes with the same token make the second fail with 401.
- Throttler counters are in memory: correct for one instance; multiple replicas need Redis storage.
