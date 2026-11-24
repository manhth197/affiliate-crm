# 007 — API: re-runnable payout generation, reports in SQL

## Context
Admins pay affiliates once a month. Generating payouts touches many commissions, may be clicked twice, and may run again after more commissions are approved. Reports need counts and sums over date ranges, bucketed by Vietnam calendar day, over thousands of rows.

## Decision
- **Payouts as a BullMQ job.** `POST /payouts/generate {month}` returns `202 {jobId}`; a worker (concurrency 1) does the work, so the request never times out on a big month.
- **Re-runnable by design.** For each affiliate with APPROVED, unpaid commissions created in the month (Vietnam calendar), one transaction: find-or-create the `(affiliate, month)` payout (UNIQUE), attach the commissions (`UPDATE … WHERE payout_id IS NULL`), then **recompute** `totalAmount`/`commissionCount` from the attached rows (never `+=`). Running it twice changes nothing; running it after new approvals tops up the DRAFT. CONFIRMED/PAID payouts are never modified; late commissions stay unattached and are logged.
- **Status changes** (`DRAFT → CONFIRMED → PAID`) use the same conditional-update pattern as leads and commissions (409 `INVALID_PAYOUT_STATUS`). Marking paid also marks its commissions PAID in the same transaction, then emits an event → `PAYOUT_PAID` notification + `payout:updated` socket event.
- **Reports in the database.** Counts and sums use Prisma `groupBy`/`aggregate`; grouping by local day needs `AT TIME ZONE 'Asia/Ho_Chi_Minh'`, so that query and the top-affiliates ranking (joins + `FILTER`) use `$queryRaw` with bound parameters. Missing days are filled with 0 in code for continuous charts. Ranges are half-open `[from, to)`, default the last 30 Vietnam days, max 366 days.

## Alternatives
- Generating payouts inside the HTTP request: simpler, but slow months would hit timeouts and a double click would race.
- Loading rows and aggregating in Node: easy to write, but moves thousands of rows over the network for a handful of numbers.
- Materialised views for reports: faster for very large data, but need refresh scheduling; not needed at this size.

## Consequences
- The web shows "đang xử lý" after generate and refreshes on `payout:updated` (or polls `GET /payouts`).
- Raw SQL is not type-checked by Prisma; it is covered by e2e tests with known data (half-open edges and day boundaries included).
