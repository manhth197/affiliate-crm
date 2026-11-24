# 006 — API: BullMQ jobs, Socket.IO rooms, idempotent signed webhooks

## Context
M3 adds work that must not slow down or break the HTTP request that triggers it (creating a commission, storing and pushing notifications), live updates in the browser, and status updates pushed by partners over the internet, who retry on any non-2xx response.

## Decision
- **Domain events → queues.** `LeadStatusService` emits `lead.status_changed` after COMMIT. Listeners add BullMQ jobs: `commissions` (create the commission when a lead is DISBURSED) and `notifications` (store + push). Jobs retry 5× with exponential backoff; workers run in the API process for now.
- **Idempotent commission job.** `jobId = commission-<leadId>` dedupes queued jobs; `UNIQUE(commissions.lead_id)` makes a double run harmless (the loser sees P2002 and returns "exists"). Amount = `floor(disbursed × bps / 10000)` with BigInt maths. A repeatable **reconcile** job (BullMQ job scheduler, every 10 min) re-queues disbursed leads without a commission, covering a crash between COMMIT and enqueue (an outbox-lite).
- **Socket.IO** namespace `/realtime`. The JWT is checked in handshake middleware (bad token → `connect_error`) and the socket is disconnected when the token expires. Sockets join `user:<id>` and `role:<ROLE>`; services emit to rooms, never to socket ids.
- **Webhook security.** HMAC-SHA256 over `${timestamp}.${rawBody}` (the exact bytes, kept with `rawBody: true`), constant-time compare, ±5 min timestamp window against replay, one generic 401 for every auth failure. A partner may only update leads whose product's `partnerName` matches its config; others get the same 404 as unknown codes.
- **Webhook idempotency.** The `(partner_id, event_id)` row is inserted inside the same transaction as the status change. Success → both commit; a repeat hits the unique index → `{ok: true, duplicate: true}`. Failure (409/422) → both roll back, so the partner's retry is evaluated again. Concurrent duplicates wait on the index lock, then see the duplicate.

## Alternatives
- Doing the work inline in the request: simpler, but a slow or failing side effect would fail the user's action.
- Storing the event id before processing: a failed change would leave the event marked "done" and swallow the partner's retry.
- Partner secrets in the database: needed once admins manage partners; env config is enough for a handful.

## Consequences
- Redis is now required for side effects (the API still serves reads if it is down; `/health` reports it).
- Several API replicas would need `@socket.io/redis-adapter` so rooms span instances; BullMQ already coordinates through Redis.
