# 008 — API: multi-stage Docker image, separate migrate job, CI with real services

## Context
The API must run the same way in CI, in Docker Compose and later on AWS. The first naive image was 789 MB because `node_modules` (413 MB) included the Prisma CLI, TypeScript and Prisma Studio. Database migrations must run once per deploy, before the new API version starts.

## Decision
- **Multi-stage Dockerfile** (`apps/api/Dockerfile`): `deps` (all deps + `prisma generate`) → `build` (`nest build`) → `prod-deps` → `runtime` (`node:26-alpine`, non-root `node` user, `HEALTHCHECK` on `/api/v1/health`).
- **Slim production deps:** `npm ci --omit=dev --omit=optional --omit=peer --ignore-scripts`. The Prisma CLI and TypeScript are *optional peers* of `@prisma/client` (flagged `devOptional`), so `--omit=dev` alone keeps them. Prisma ships a query compiler per database; only PostgreSQL's is kept, and source maps are removed. Result: `node_modules` 77 MB, image 348 MB.
- **Migrations as a separate target/service** (`migrate`): runs `prisma migrate deploy` and exits; in Compose the `api` service waits for it (`service_completed_successfully`). The runtime image never contains the Prisma CLI, and migrations never race between several API replicas.
- **Compose profile `app`:** `docker compose up -d postgres redis` stays the local-dev command; `--profile app` adds `migrate` + `api`. Secrets come from the environment; the API refuses to start without `JWT_ACCESS_SECRET`.
- **GitHub Actions** (`.github/workflows/api.yml`): lint, Prettier, typecheck, unit tests, e2e tests against Postgres 16 and Redis 7 service containers, a check that `docs/openapi.json` matches the code, then a build of both images (Buildx with GitHub cache).

## Alternatives
- Running `prisma migrate deploy` in the API container's start command: simplest, but every replica would try to migrate at boot and the runtime image would need the CLI.
- Distroless base image: smaller and no shell, but harder to debug and the health check needs a binary; Alpine is a reasonable middle ground.
- Testcontainers in CI: same isolation, but slower than GitHub service containers.

## Consequences
- Seeding in Docker uses the `migrate` image: `docker compose --profile app run --rm migrate npx prisma db seed`.
- The Compose API and a local `npm run start:dev` share Redis DB 0; run only one of them at a time (their BullMQ workers would share jobs).
