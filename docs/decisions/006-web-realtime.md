# 006 (web) — Realtime: one connection, events invalidate the cache

## Context
The API pushes `notification:new`, `lead:updated` and `payout:updated` over Socket.IO (namespace `/realtime`, JWT in the handshake). The server **disconnects the socket when the access token expires** and does not reconnect it. The web also runs without a backend (MSW mock mode, Vitest), where there is no Socket.IO server.

## Decision
- **A small interface** (`RealtimeConnection`: `on(event, handler)`, `close()`) with two implementations chosen by config: `socket.io-client` for the real API, an in-memory "room bus" for mock mode and tests. The mock handlers emit to the same rooms the API uses (`user:<id>`, `role:<ROLE>`), so the whole flow — staff action → API → event → affiliate's screen — runs in tests.
- **Token lifecycle:** the handshake reads the current access token on every (re)connect. On `disconnect` with reason `io server disconnect` we get a valid token (refreshing through the same single-flight refresh as HTTP) and reconnect. A refused handshake (`connect_error` while `socket.active` is false) forces a refresh and retries with exponential backoff (max 5). Network drops are left to Socket.IO's own retry.
- **Events invalidate TanStack Query caches instead of writing data into them** (`RealtimeBridge`, rendered once inside the logged-in layout): `lead:updated` → that lead + lead lists; `payout:updated` → finance; `notification:new` → notifications + a toast with a "Xem" button. Whatever is on screen refetches from the API, which stays the single source of truth (and applies masking/permissions).
- The connection lives as long as the logged-in layout; logout or session expiry unmounts it and closes the socket.

## Alternatives
- **Patch the cache from event payloads** — saves a request, but the events carry only ids/status, and the client would have to re-implement server rules (masking, list filters, sort order).
- **Polling** — simpler, but laggy and wasteful; a background job (payout generation) is still covered by a few timed refetches.
- **Mock Socket.IO through MSW (`@mswjs/socket.io-binding`)** — only supports MSW 2; we use MSW 3.

## Consequences
- An event can cause a few refetches (e.g. the kanban's six columns); acceptable at this scale and cheap with the API's indexes.
- Checked end-to-end against the real API in Edge: a staff status change, the commission job and a paid payout each reached the affiliate's open page live (toast, bell count, page data).
