# Affiliate CRM — API

NestJS 11 · TypeScript (strict) · Prisma 7 · PostgreSQL 16 · Redis 7

The API contract lives in [`docs/api-contract.md`](../../docs/api-contract.md); the generated
OpenAPI document is [`docs/openapi.json`](../../docs/openapi.json).

## Quick start

Requirements: Node.js 24+ and Docker.

```bash
# 1. Infrastructure (from the repo root): Postgres on :5433, Redis on :6380
docker compose up -d postgres redis

# 2. API (from apps/api)
cp .env.example .env          # then set JWT_ACCESS_SECRET to a long random string
npm install                   # also runs `prisma generate`
npm run db:deploy             # apply migrations
npm run db:seed               # demo accounts, password Demo@12345
npm run start:dev
```

- API: http://localhost:3000/api/v1 (e.g. `GET /api/v1/health`)
- Swagger UI: http://localhost:3000/api/docs (JSON at `/api/docs-json`)

Demo data (`npm run db:seed`): accounts `admin@demo.vn`, `staff@demo.vn`, `ctv1@demo.vn` … `ctv3@demo.vn` (password `Demo@12345`); 6 products (fictional partners); 120 leads over the last 60 days in every status with a realistic timeline (some updates arrive by webhook from "Tài chính An Phát"); commissions for disbursed leads (pending, approved, paid, cancelled); one PAID payout for `ctv1` (last month); a few notifications. The pipeline is generated only when there are no leads yet; `npm run db:reset` drops everything and re-seeds.

## Scripts

| Script | What it does |
|---|---|
| `npm run start:dev` | Run with watch mode |
| `npm run build` / `start:prod` | Compile to `dist/` / run the compiled app |
| `npm run lint` / `format` / `typecheck` | ESLint, Prettier, `tsc --noEmit` |
| `npm test` | Unit tests (no DB needed) |
| `npm run test:e2e` | e2e tests against the Docker Postgres/Redis (uses database `affiliate_crm_test`, created automatically) |
| `npm run db:migrate -- --name <name>` | Create and apply a new migration (development) |
| `npm run db:deploy` | Apply pending migrations (CI / production) |
| `npm run db:seed` | Insert demo data (idempotent) |
| `npm run db:reset` | **Drop all data**, re-apply migrations, re-seed (local dev only) |
| `npm run openapi:export` | Write `docs/openapi.json` (no DB or Redis needed) |

## Layout

```
src/
  main.ts, app.module.ts, app.setup.ts   bootstrap, global pipe/filter/guards, Swagger
  openapi.ts                             OpenAPI export entry point
  config/        env validation (fails fast on startup)
  prisma/        PrismaService (driver adapter: node-postgres)
  redis/         shared ioredis client
  auth/          register/login/refresh/logout/me, JWT + roles guards, token rotation
  users/         admin user management, GET /staff, password hashing, referral codes
  products/      products and commission rules (admin)
  leads/         leads CRUD/filters/CSV, status machine, the single status-change service, events
  audit/         append-only audit log (written in the same transaction as the change)
  queues/        BullMQ setup and queue/job names (commissions, payouts, notifications)
  commissions/   commission job (idempotent), reconcile scheduler, list/summary/approve/cancel
  notifications/ notifications queue + worker, Vietnamese messages, read/unread API
  realtime/      Socket.IO gateway /realtime (JWT handshake, user/role rooms)
  payouts/       monthly payout job (re-runnable), confirm, mark-paid
  reports/       overview and top affiliates (SQL aggregates, Vietnam-day buckets)
  webhooks/      partner status webhook: HMAC guard, idempotency by eventId
  health/        GET /health (DB + Redis probes)
  common/        error format, validation, pagination, dates (Asia/Ho_Chi_Minh), CSV, PII masking
  generated/     Prisma client (generated, not committed)
prisma/          schema.prisma, migrations/, seed.ts + seed-pipeline.ts (deterministic demo data)
test/            e2e tests (supertest) and helpers
```

## Conventions

- Every route requires a Bearer token unless marked `@Public()`; restrict by role with `@Roles(...)`.
- Errors always look like `{ statusCode, error, code?, message, details? }`; business errors carry a `code` (see `common/errors/error-codes.ts`).
- Affiliates only ever see their own leads, with customer phone/national ID masked.
- Every lead status change goes through `LeadStatusService` (activity + audit + event).
- Date filters are half-open `[from, to)` ISO datetimes; months and days use the Vietnam calendar.
- Money is VND integers (`BIGINT` in the DB). IDs are UUID v7. Timestamps are `timestamptz`.
- Design decisions: [`docs/decisions`](../../docs/decisions) (files with `api` in the name).

## Background jobs and realtime

- Side effects run as BullMQ jobs inside the API process: a commission when a lead is DISBURSED, and notifications (stored, then pushed over Socket.IO). A reconcile job re-queues missing commissions every `COMMISSION_RECONCILE_MINUTES`.
- Socket.IO: connect to namespace `/realtime` (path `/socket.io`) with `auth: { token: accessToken }`. Events: `notification:new`, `lead:updated`, `payout:updated`. The server disconnects the socket when the token expires; reconnect with a fresh one.

## Partner webhook

`POST /api/v1/webhooks/partner-status` is signed instead of logged in. Partners are configured in `PARTNER_WEBHOOKS` (JSON). Example with the dev partner from `.env.example` (lead `LD-000001` must belong to a "Tài chính An Phát" product and be SUBMITTED):

```bash
BODY='{"eventId":"evt-1","leadCode":"LD-000001","status":"APPROVED"}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac 'dev-secret-an-phat-change-me' | sed 's/^.* //')
curl -X POST http://localhost:3000/api/v1/webhooks/partner-status \
  -H 'Content-Type: application/json' -H 'X-Partner-Id: an-phat' \
  -H "X-Timestamp: $TS" -H "X-Signature: $SIG" -d "$BODY"
```

## Docker

From the repo root:

```bash
# Postgres + Redis + migrations + the API (port 3000; set API_PORT to change it)
JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))") \
  docker compose --profile app up -d --build
docker compose --profile app run --rm migrate npx prisma db seed   # demo data
docker compose --profile app down                                  # stop (keeps volumes)
```

- `apps/api/Dockerfile` is multi-stage: target `runtime` (the API, ~350 MB, non-root, health check) and target `migrate` (`prisma migrate deploy`, also used for seeding).
- Do not run the Docker API and `npm run start:dev` at the same time: both use Redis DB 0 and their BullMQ workers would share jobs (realtime pushes would go to the wrong process).

## CI

`.github/workflows/api.yml` runs on changes to `apps/api/**`: lint, Prettier check, typecheck, unit tests, e2e tests against Postgres/Redis service containers, a check that `docs/openapi.json` is up to date (run `npm run openapi:export` and commit if it fails), then builds both Docker images.

## Known issues

- Running the tests prints `DeprecationWarning: Calling client.query() when the client is already executing a query` from `pg`. It comes from inside Prisma 7.10's `@prisma/adapter-pg` (its query interpreter runs sub-queries of one transaction concurrently), not from this code. Harmless with `pg@8`; re-check when upgrading to `pg@9`, which removes that behaviour.
