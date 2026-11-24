# 004 — API: one status-change service, optimistic concurrency, events after commit

## Context
A lead's status can be changed by staff (HTTP) and, from M3, by a partner webhook. Each change must also write a timeline entry and an audit-log row, and trigger side effects (commission job, notifications, Socket.IO). Two people can act on the same lead at the same moment, and two affiliates can try to refer the same customer.

## Decision
- **One service** (`LeadStatusService.changeStatus`) is the only code that changes `leads.status`. Both sources call it with a `source` (`user` or `partner`), so the rules, activity type (`STATUS_CHANGED` vs `WEBHOOK`) and audit entry cannot drift apart.
- **Pure state machine** (`lead-status.machine.ts`): a lookup table of allowed transitions, unit-tested for all 36 pairs. Invalid → 409 with the allowed next steps in the message.
- **Optimistic concurrency:** `UPDATE leads SET status = :to WHERE id = :id AND status = :from`. If 0 rows change, someone else won → 409 "reload and try again". No row locks held while the user thinks.
- **Atomicity:** status update, activity and audit row are one transaction; either all are written or none.
- **Events after COMMIT:** `lead.status_changed` is emitted with `@nestjs/event-emitter` only after the transaction commits, so listeners never act on a rolled-back change. Leads do not import queues or sockets; M3 listeners do.
- **PII masking at serialization:** the mapper takes the viewer and masks phone/national ID for affiliates, so no endpoint can forget it. Affiliate row-level filtering lives in one `buildLeadWhere` function.
- **Duplicate referrals:** one open lead per (product, customer phone). The check runs under `pg_advisory_xact_lock(hash(product, phone))`, which serialises concurrent submissions for that pair only; a plain "check then insert" would race.

## Alternatives
- `SELECT … FOR UPDATE`: also correct, but holds a row lock; the conditional update needs no lock and tells us directly whether we won.
- Emitting events inside the transaction: listeners could enqueue a commission for a change that is then rolled back.
- Transactional outbox table: survives a crash between commit and emit. Not needed yet because the commission job is idempotent (`UNIQUE commissions.lead_id`) and can be re-run by a reconciliation job; noted as a future improvement.
- Partial unique index for duplicates: strongest guarantee, but Prisma cannot express partial indexes and would try to drop it in later migrations.

## Consequences
- Clients must handle 409 on status changes (reload the lead).
- In-process events are lost if the process dies right after commit (see outbox above).
