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

Demo accounts: `admin@demo.vn`, `staff@demo.vn`, `ctv1@demo.vn` … `ctv3@demo.vn` (password `Demo@12345`).

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
  users/         user lookups, DTOs, mappers, referral codes
  health/        GET /health (DB + Redis probes)
  common/        error format, validation helpers, PII masking
  generated/     Prisma client (generated, not committed)
prisma/          schema.prisma, migrations/, seed.ts
test/            e2e tests (supertest) and helpers
```

## Conventions

- Every route requires a Bearer token unless marked `@Public()`; restrict by role with `@Roles(...)`.
- Errors always look like `{ statusCode, error, message, details? }` (see `common/errors`).
- Money is VND integers (`BIGINT` in the DB). IDs are UUID v7. Timestamps are `timestamptz`.
- Design decisions: [`docs/decisions`](../../docs/decisions) (files with `api` in the name).
