# 001 (web) — Where the web app keeps auth tokens

## Context
The API issues a JWT access token (15 min) and a refresh token (7 days, single-use: every refresh rotates it, and reusing an old one revokes the session). Until contract v0.5 the refresh token travelled in JSON bodies, so the web kept it in `localStorage`, where any XSS bug could read it and keep a session alive elsewhere for a week. Since **v0.6** the API also puts it in an **httpOnly cookie** (`crm_rt; Path=/api/v1/auth; SameSite=Strict`).

## Decision
- **Access token: in memory only** (`src/api/token-store.ts`), sent as `Authorization: Bearer`. Gone on reload.
- **Refresh token: the httpOnly cookie only.** JavaScript never sees it. `/auth/login`, `/register`, `/refresh` and `/logout` are called with `credentials: "include"`; refresh and logout send `Content-Type: application/json` with `{}` (cookie-only refresh without JSON → 415). The body's `refreshToken` is ignored (v0.7 removes it).
- `localStorage` keeps only a **non-secret hint** (`affiliate-crm.session = 1`): a guest does not fire a pointless refresh on every load, and other tabs see log in/out through the `storage` event. The old `affiliate-crm.refreshToken` key is deleted on load (users of the old version log in once more).
- After a reload the first API call refreshes with the cookie, then proceeds. With `expiresIn`, the client also refreshes 30 s **before** expiry, so normal use never sees a 401.
- **Single-flight + cross-tab lock:** concurrent 401s share one refresh; the Web Locks API serializes refreshes across tabs, because all tabs share one cookie and a second parallel refresh with the same single-use token would get 401.
- A rejected refresh (401/403; the API clears the cookie too) ends the session: hint removed, query cache cleared, back to `/login` with a toast. 5xx/network errors keep the session.

## Alternatives
- **Refresh token in `localStorage`** (what we did until v0.6) — simple, survives reloads, but readable by any XSS.
- **sessionStorage / memory only** — smaller exposure, but new tabs or reloads log the user out.
- **Backend-for-frontend with server sessions** — strongest, but adds a component; not needed while web and API are same-site.

## Consequences
- XSS can no longer **steal** the refresh token. Script running in the page could still call `/auth/refresh` while the user is there, so output escaping (React), no `dangerouslySetInnerHTML`, and the nginx CSP still matter.
- Web and API must stay **same-site** (`localhost:5173` → `localhost:3000`, or one domain behind the nginx proxy) for `SameSite=Strict`; cross-site would need `SameSite=None; Secure` + CSRF tokens.
- The mock API emulates the cookie (MSW's own cookie store is off under Node), so tests cover reload-restores-session, logout, 415 and rotation.
