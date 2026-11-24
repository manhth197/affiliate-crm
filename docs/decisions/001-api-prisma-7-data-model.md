# 001 — API: Prisma 7 with a driver adapter, and data-model conventions

## Context
The API needs a type-safe ORM for PostgreSQL 16 with versioned migrations. Prisma 7 (current stable) no longer ships a Rust query engine: it talks to the database through a JavaScript driver adapter and reads the connection URL from `prisma.config.ts`.

## Decision
- Prisma 7 with `@prisma/adapter-pg` (node-postgres). The client is generated into `src/generated/prisma` (`moduleFormat = "cjs"`, extensionless imports) so it compiles with the rest of the NestJS app; it is not committed and is regenerated on `npm install`.
- Connections are lazy (no `$connect()` at startup), so tools such as the OpenAPI export boot without a database. `/health` reports DB status.
- Money (`requestedAmount`, `disbursedAmount`, commission and payout amounts) is VND stored as `BIGINT`; mappers convert to JSON numbers (exact up to 9·10^15). `INT` would overflow at ~2.1 billion VND, a normal loan size.
- IDs are UUID v7 (time-ordered, so B-tree inserts stay at the end of the index). Lead codes (`LD-000123`) come from a separate auto-increment `number` column.
- Tables/columns are `snake_case` via `@@map`/`@map` so raw SQL in reports reads naturally. Timestamps are `timestamptz`.
- Idempotency is enforced by the database, not only by code: one commission per lead (`UNIQUE lead_id`), one payout per affiliate per month, one webhook event per `(partnerId, eventId)`.

## Alternatives
- TypeORM / MikroORM: decorators on entities fit Nest, but weaker type inference on queries and less reliable migration generation.
- Prisma 6 with the Rust engine: older but stable; Prisma 7 is the supported line going forward and removes a native binary from the Docker image.
- `DECIMAL` for money: exact, but VND has no minor unit, and `Decimal` objects complicate JSON and arithmetic.

## Consequences
- Jest needs `--experimental-vm-modules` for e2e tests because the Prisma 7 client loads its query compiler with a dynamic `import()` (Node supports it natively; Jest's VM does not without the flag).
- `BigInt` must be converted explicitly in every mapper; JSON.stringify throws on raw `bigint`.
- The full domain schema exists from M1; later milestones add migrations rather than rewrite tables.
