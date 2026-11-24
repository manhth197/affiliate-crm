# 003 — API: unit tests for logic, e2e tests against real Postgres and Redis

## Context
Most bugs in this API would live in two places: pure business rules (status machine, commission maths, masking, HMAC, token rotation) and the interaction with the database (constraints, transactions, raw SQL). Mocking Prisma well enough to catch the second kind is expensive and gives false confidence.

## Decision
- **Unit tests** (`src/**/*.spec.ts`, `npm test`): pure functions and services with hand-written fakes. No database, run in ~2 s.
- **e2e tests** (`test/*.e2e-spec.ts`, `npm run test:e2e`): boot the real `AppModule` and call it over HTTP with supertest, against the Docker Postgres and Redis.
- The e2e suite always uses a separate database whose name must end in `_test` (default `affiliate_crm_test`, override with `TEST_DATABASE_URL`). Global setup creates it if needed and runs `prisma migrate deploy`; suites truncate tables in `beforeAll`. Suites run serially (`--runInBand`).
- Global pipe, filter and guards are registered as `APP_*` providers, so tests exercise exactly the production pipeline.

## Alternatives
- Testcontainers (a fresh container per run): fully isolated, but slower and heavier on a 16 GB laptop; CI service containers give the same result.
- `prisma migrate reset` before each run: simpler, but destructive commands are guarded when run by tools, and truncation is faster.
- SQLite for tests: different SQL dialect; would hide Postgres-specific bugs.

## Consequences
- `docker compose up -d postgres redis` is required before `npm run test:e2e`.
- CI needs Postgres and Redis service containers and `TEST_DATABASE_URL` / `TEST_REDIS_URL`.
