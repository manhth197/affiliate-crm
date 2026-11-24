# 002 (web) — Mock the API with MSW, built from the contract

## Context
The web and API are built in parallel. The web must not wait for the backend, and tests need realistic API behaviour (status codes, error shape, token rotation) without a running server.

## Decision
- Use **Mock Service Worker (MSW 3)**. Handlers in `src/mocks/handlers/` implement the endpoints of `docs/api-contract.md` on top of a small in-memory database (`src/mocks/db.ts`) seeded like the contract's "Seed data" (same demo accounts and password).
- The **same handlers** run in two places: in the browser through a Service Worker (`npm run dev:mock`), and in Vitest through `setupServer` (`src/mocks/node.ts`). Tests render the real app and talk to the mock API over `fetch`, so the API client, guards and forms are tested together.
- The app code does not know about mocks: it always calls `VITE_API_URL` with `fetch`. Mocks are switched on by `--mode mock` or `VITE_USE_MOCKS=true`. The mock code is loaded with a dynamic `import()` only in that case, and the worker script is served by the `msw/vite` plugin only then, so a normal production build does not ship it.
- In mock mode the database is saved to `localStorage` after each write, so a reload keeps the session and created data.
- Mock handlers reproduce server rules the UI depends on (RBAC 401/403, validation 400 with `details`, 409 on duplicates, refresh token rotation, and later PII masking for affiliates).

## Alternatives
- **json-server / a fake Express server** — another process to run, and tests would need it too.
- **Mocking `fetch` or the API module in tests (vi.mock)** — faster to write, but skips the real client (headers, refresh, error parsing) and drifts from reality.
- **Waiting for the real API** — blocks the web work for weeks.

## Consequences
- The mock is a second implementation of the contract and can drift. When `docs/openapi.json` lands, the client switches to generated types, and the mock handlers will be type-checked against them.
- Running the real backend is just `VITE_USE_MOCKS=false` (the default) and `npm run dev`.
