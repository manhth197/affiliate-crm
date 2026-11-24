# 009 — API: refresh token in an httpOnly cookie (contract v0.6)

## Context
Until v0.5 the refresh token (7 days) travelled in JSON bodies, so the web app had to keep it where JavaScript can read it. Any XSS bug could then steal it and keep a session alive from another machine for a week. The access token (15 min) stays in memory and in the `Authorization` header.

## Decision
- `register`, `login` and `refresh` also set `crm_rt=<token>; HttpOnly; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800` (+ `Secure` when `COOKIE_SECURE=true`, i.e. HTTPS in production).
- `/auth/refresh` and `/auth/logout` use the body token if present (old clients, deprecated), otherwise the cookie. Logout always clears the cookie; a refresh that fails with 401/403 clears it too.
- A cookie-only refresh must be `Content-Type: application/json`, otherwise 415 (and the token is not consumed).
- CORS allows credentials only for the configured web origins (never `*`).

## Why this is enough against CSRF
- `SameSite=Strict`: the browser does not attach the cookie to any request started by another site (forms, links, `<img>`, `fetch`). `localhost:5173` → `localhost:3000` is the same site (ports are ignored), and so are `app.example.com` → `api.example.com`.
- The JSON content type makes every cross-origin call a CORS preflight, which only the allowed origins pass; a plain HTML form cannot send `application/json`. Requiring it closes the "simple request" gap even for same-site but untrusted origins.
- `Path=/api/v1/auth` keeps the cookie off every other route, and the refresh endpoint only returns tokens to readers allowed by CORS. Rotation + reuse detection (decision 002) still apply.

## Trade-offs
- XSS can no longer **read** the refresh token, but script running in the page can still call `/auth/refresh` and use the resulting access token while the user is on the page. httpOnly limits the damage to the session in progress; it does not replace output escaping and a CSP.
- Cross-site deployments (web and API on different registrable domains) would need `SameSite=None; Secure` plus a CSRF token; the current setup avoids that by keeping them same-site.
- Transition: the token is still in response bodies until the web switches (v0.7 removes it), so the XSS benefit is only complete after v0.7.

## Alternatives
- Keep tokens in `localStorage`: simplest, readable by any XSS.
- Backend-for-frontend with server-side sessions: strongest, but adds a component and state.
