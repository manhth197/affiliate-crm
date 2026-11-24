# 007 (web) — Docker image: static build behind nginx, same origin as the API

## Context
The web app is a static Vite build. It talks to the API over HTTP and Socket.IO, and since contract v0.6 the refresh token is an httpOnly `SameSite=Strict` cookie. In Docker Compose (and later on AWS) the web and the API must work together without CORS headaches, and the image should be small and safe by default.

## Decision
- **Multi-stage image:** `node:26-alpine` runs `npm ci` + `npm run build`; `nginx:1.30-alpine` serves `dist/`. The final image has no Node and no source (≈100 MB, mostly nginx/alpine).
- **nginx is also the reverse proxy:** `/api/` and `/socket.io/` (with WebSocket upgrade) go to `API_UPSTREAM` (default `http://api:3000`). The browser sees **one origin**, so there is no CORS preflight and the refresh cookie is first-party. The app is built with `VITE_API_URL=/api/v1` (relative) and an empty `VITE_SOCKET_URL` (same origin).
- **Runtime config by environment, build config by args:** `VITE_*` values are compiled into the JavaScript (build args); nginx settings (`API_UPSTREAM`, `NGINX_RESOLVER`, `CSP_CONNECT_SRC`) are rendered at container start by the official image's envsubst templates. nginx resolves the upstream per request, so it starts even before the API.
- **Caching:** hashed `/assets/*` for a year (`immutable`); `index.html` and SPA routes `no-cache`, so a deploy is picked up on the next load. `try_files … /index.html` serves deep links.
- **Security headers:** a CSP that allows scripts only from the origin (the build has no inline scripts; MSW is not in production builds), inline styles only (Radix, Recharts and sonner position elements with style attributes), `connect-src 'self'`, `frame-ancestors 'none'`; plus `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `server_tokens off`. `/healthz` for health checks.

## Alternatives
- **Separate origins (web :8080, API :3000) with CORS** — works in dev, but every deployment must keep CORS origins and cookie settings in sync.
- **Runtime `config.js` instead of build args** — one image for every environment; worth it once there are several environments. Today the relative `/api/v1` already makes the image environment-independent.
- **Serve the files from the API (NestJS static)** — one container fewer, but couples web releases to API releases and puts static traffic on Node.

## Consequences
- The API sees requests from nginx: it gets `X-Forwarded-For`/`X-Forwarded-Proto`, and should trust the proxy for per-IP rate limiting.
- Verified locally: the image builds, and the full integration scenario passed through the container against the real API with no CSP violations.
