# 005 (web) — Kanban drag-and-drop with optimistic status changes

## Context
Staff move leads through `NEW → CONTACTED → SUBMITTED → APPROVED → DISBURSED` (or `REJECTED`) on a kanban board. The board must work with a mouse, on phones and with a keyboard. Several people work the same pipeline, and the API rejects stale moves with 409 (`INVALID_TRANSITION`, `CONCURRENT_UPDATE`; see `004-api-lead-pipeline-consistency.md`).

## Decision
- **`@dnd-kit/core` 6** for drag-and-drop: pointer events (mouse + touch + pen) and a keyboard sensor, with screen-reader announcements we translated to Vietnamese. Native HTML5 drag-and-drop does not work on touch screens; `@dnd-kit/react` is still 0.x.
- **Drag by a handle** (grip button), not the whole card: the card itself stays a normal link to the lead, a phone can still scroll the board, and keyboard users focus the handle, press Space, use ←/→ to jump between columns (custom coordinate getter) and Space to drop.
- **The rules live in one pure function**, `planDrop(from, to)` → `ignore | invalid | dialog | direct`, using the same transition table as the API. While dragging, allowed columns are highlighted and the others dimmed. `DISBURSED` opens a dialog for the amount, `REJECTED` asks for a reason; other moves happen at once.
- **Optimistic update** in `useChangeLeadStatus`: `onMutate` moves the card between the cached column queries (remove from the old status list, add to the new one, fix the totals) and keeps a snapshot; `onError` restores the snapshot; `onSettled` refetches the lists and the lead. So the board feels instant, and after a 409 the screen always ends up showing the server's state with a Vietnamese message.
- One request per column: open columns load up to 100 leads, the one waiting longest first (`updatedAt:asc`); closed columns show only the 20 most recent with a link to the full table.

## Alternatives
- **Wait for the server before moving the card** — simpler, but a visible delay on every drop.
- **One big request for the whole board** — needs a new endpoint or `pageSize` > 100; per-status queries also reuse the list endpoint and its cache keys.
- **A full kanban library** — more than we need, and harder to explain than ~250 lines on top of dnd-kit.

## Consequences
- Drag-and-drop cannot be tested in jsdom (no layout), so `planDrop` and the optimistic cache logic have unit tests, and the real drag (mouse, keyboard, invalid drop, dialog) was checked in Edge with Playwright against the mock server.
- On narrow screens the board scrolls sideways; the table view (same filters, in the URL) is the alternative on phones.
