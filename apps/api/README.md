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

Demo accounts: `admin@demo.vn`, `staff@demo.vn`, `ctv1@demo.vn` … `ctv3@demo.vn` (password `Demo@12345`), plus 6 demo products (fictional partners).

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
  webhooks/      partner status webhook: HMAC guard, idempotency by eventId
  health/        GET /health (DB + Redis probes)
  common/        error format, validation, pagination, dates (Asia/Ho_Chi_Minh), CSV, PII masking
  generated/     Prisma client (generated, not committed)
prisma/          schema.prisma, migrations/, seed.ts
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
