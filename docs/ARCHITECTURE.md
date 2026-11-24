# Affiliate CRM — Architecture (draft v0.1)

## Goal
A mini CRM for a network of affiliates (cộng tác viên) who refer customers for financial products (loans, credit cards, insurance). Affiliates submit leads, staff move leads through a pipeline, commissions are calculated automatically, and everyone gets realtime notifications. It is a portfolio project that demonstrates full-stack TypeScript: NestJS, Prisma, PostgreSQL, Redis/BullMQ, Socket.IO, React, Docker, CI, and later a deployment on AWS.

## Roles
- **AFFILIATE**: submits leads, sees only their own leads with customer PII masked, tracks commissions and payouts, gets notifications.
- **STAFF**: works the lead pipeline (assign, change status, add notes).
- **ADMIN**: everything STAFF can do, plus products and commission rules, payouts, users, reports.

## Core flows
1. Affiliate registers (gets a referral code) → logs in → submits a lead for a product.
2. Staff assigns the lead and moves it: `NEW → CONTACTED → SUBMITTED → APPROVED → DISBURSED` (or `REJECTED` from any open status). Every change writes a lead activity and an audit log entry.
3. A partner (bank / finance company) may push status updates through a signed webhook (HMAC-SHA256), which goes through the same status-change service.
4. When a lead reaches `DISBURSED`, a BullMQ job creates a `PENDING` commission from the product's rule (percent of loan amount or a fixed amount).
5. Status changes and new commissions notify the affiliate in realtime (Socket.IO) and are stored as notifications.
6. Admin generates a monthly payout per affiliate (BullMQ job groups `APPROVED` commissions), then marks it paid.
7. Reports: leads by status, conversion rate, commission totals by month, top affiliates (SQL aggregates).

## Tech stack
| Layer | Choice |
|---|---|
| API | NestJS 11, TypeScript (strict), Prisma ORM, PostgreSQL 16 |
| Jobs & cache | Redis 7, BullMQ |
| Realtime | Socket.IO (NestJS gateway), JWT in the handshake |
| Auth | JWT access token (15 min) + refresh token (7 days, rotated, stored hashed), bcrypt/argon2 |
| Validation & docs | class-validator / class-transformer, `@nestjs/swagger` (OpenAPI at `/api/docs`, exported to `docs/openapi.json`) |
| Web | React 18/19 + Vite + TypeScript, React Router, TanStack Query, react-hook-form + zod, Tailwind CSS + shadcn/ui, socket.io-client, Recharts |
| Testing | API: Jest unit + e2e (supertest) against a real Postgres/Redis in Docker. Web: Vitest + Testing Library, MSW for API mocks |
| Ops | Docker Compose (postgres, redis, api, web), GitHub Actions CI; AWS deployment in a later phase |

## Security notes
- RBAC guards on every route; affiliates can only read their own data.
- PII masking at serialization for AFFILIATE: phone `09******89` (first 2 + last 2 digits), national ID (CCCD) `*********123` (last 3).
- Webhook signature check with a shared secret, timestamp tolerance 5 minutes, idempotency by event id.
- Rate limiting on auth routes; secrets only in `.env` (never committed); audit log for status changes, payouts and admin edits.

## Repo layout
Two independent npm projects (each with its own `package.json` and lockfile), so the API and web branches never edit the same lockfile.
```
apps/api   NestJS app (worktree branch dev/api)
apps/web   React app  (worktree branch dev/web)
docs/      ARCHITECTURE.md, api-contract.md, openapi.json, decisions/
docker-compose.yml   # owned by the API branch: postgres, redis (+ api, web later)
```
Branches: `main` (integration, coordinator merges), `dev/api`, `dev/web`.

Local ports (chosen so this stack can run next to the RAG project): API 3000, web 5173, Postgres host port 5433, Redis host port 6380.

## Milestones
| # | API (dev/api) | Web (dev/web) |
|---|---|---|
| M1 | Scaffold, Prisma schema + migrations, docker-compose (postgres, redis), auth (register/login/refresh/me), health | Scaffold Vite + Tailwind + shadcn, routing, layout, auth pages, typed API client, MSW mocks from the contract |
| M2 | Products, leads (CRUD, filters, pagination), status machine, RBAC, PII masking, activities, audit log | Affiliate area: dashboard, leads list + create form, lead detail, commissions, payouts |
| M3 | BullMQ commission job, notifications (DB + Socket.IO), partner webhook with HMAC | Staff/Admin area: pipeline (table + kanban), lead detail with status change and timeline, products, users |
| M4 | Payouts job, reports endpoints, seed script, Swagger export | Realtime (socket.io-client), notifications panel, reports dashboard (Recharts), admin commissions (approve/cancel) and payouts (generate/confirm/mark paid), responsive/mobile |
| M5 | Unit + e2e tests, Dockerfile, CI job | Component tests, production build, Dockerfile (nginx), CI job |
| M6 | Integration on `main`, end-to-end smoke test, README with screenshots, AWS deployment (with owner approval) | |
