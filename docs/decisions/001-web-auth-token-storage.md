# 001 (web) — Where the web app keeps auth tokens

## Context
The API (contract v0.1) returns a JWT access token (15 min) and a refresh token (7 days, rotated on every use) in the JSON body, and expects the refresh token back in the body of `POST /auth/refresh`. So the browser must hold the refresh token somewhere JavaScript can read. Users expect to stay logged in after a reload and when they open a lead in a new tab.

## Decision
- **Access token: in memory only** (a module variable in `src/api/token-store.ts`). It is never written to storage, so it disappears on reload.
- **Refresh token: `localStorage`**, so the session survives reloads and is shared by tabs.
- The API client (`src/api/client.ts`) attaches the access token, and on a 401 refreshes **once** and retries. Concurrent 401s share one refresh call (single-flight promise). After a reload it refreshes before the first request.
- Refreshes are serialized across tabs with the **Web Locks API**, and the refresh token is read *inside* the lock. Because tokens rotate, two tabs sending the same token would make the second one fail (and a server with reuse detection would revoke the whole session).
- A rejected refresh (400/401/403) clears the session and sends the user to `/login` with a toast. 5xx/network errors keep the session.
- Logout revokes the refresh token on the server (best effort, 3 s timeout), clears tokens and the whole TanStack Query cache. Other tabs follow through the `storage` event.

## Alternatives
- **httpOnly + Secure + SameSite=Strict cookie for the refresh token** — the safest option (JavaScript can never read it), but it needs an API contract change (cookie on `/auth/refresh`, CORS with credentials, CSRF thinking). Proposed to the coordinator as a later improvement; the client change would be small (send `credentials: 'include'`, stop storing the token).
- **sessionStorage** — slightly smaller exposure (one tab), but every new tab asks for login again.
- **Memory only** — safest without cookies, but every reload logs the user out.

## Consequences
- An XSS bug could read the refresh token from `localStorage`. Mitigations: React escapes output and we never use `dangerouslySetInnerHTML`; short-lived access tokens; rotation (a stolen token stops working once the real user refreshes); a strict Content-Security-Policy in the nginx config (M5).
- Token handling lives in one place (`token-store.ts` + `client.ts`), so moving to cookies later touches only those files.
