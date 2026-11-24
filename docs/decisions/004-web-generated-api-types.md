# 004 (web) — API types generated from OpenAPI, hand-written only where needed

## Context
The API and the web are built in parallel. The contract (`docs/api-contract.md`) is the source of truth, and the API exports `docs/openapi.json` from Swagger. In M1 the web had to write every type by hand. In M2 the export covers auth, users, staff, products and leads, but not yet commissions, payouts, notifications or reports, and in two places it is behind the contract (error `code`, `LeadActivity.assignee`).

## Decision
- `npm run gen:api` runs **openapi-typescript** on `docs/openapi.json` and writes `src/api/schema.gen.ts`. The file is **committed** (so a build or Docker image does not depend on the repo's `docs/` folder) and ignored by ESLint/Prettier.
- `src/api/types.ts` is the only file the app imports types from. It re-exports generated schemas (`Lead`, `Product`, `Me`…) and keeps hand-written types for what the export does not have yet.
- Where the contract is ahead of the export, the field is added as **optional** with a "contract v0.3" comment (e.g. `ApiErrorBody.code`, `LeadActivity.assignee`). The UI handles both shapes (e.g. the timeline falls back to the assignee name in `note`).
- Enum value lists the UI needs at runtime (`LEAD_STATUSES`) use `satisfies readonly LeadStatus[]`, so they cannot drift from the generated union.
- The MSW mocks use the same types, so a contract change in the export also breaks the mocks at compile time.

## Alternatives
- **Generated client (openapi-fetch / orval)** — also generates the fetch layer. Our hand-written client already does token refresh, single-flight and error mapping; a generated client would need wrapping anyway. Types alone give most of the safety.
- **Generate at build time, do not commit** — cleaner diffs, but the web build would then need the API's export at build time and CI would be harder to reason about.
- **Keep everything hand-written** — no tooling, but drift is only found when the real API is called.

## Consequences
- When the API changes a schema, `npm run gen:api` + `tsc` show every place in the web that must change.
- Someone must re-run `gen:api` after each merge of `main`; a CI check that the generated file is up to date is planned for M5.
