# Affiliate CRM — API Contract v0.4

Source of truth for `apps/api` and `apps/web`. Changes go through the coordinator (see `_dieu-phoi/CONVENTIONS.md`). Once the API runs, `docs/openapi.json` (exported from Swagger) must match this document.

## Changelog
- **v0.4 (2026-11-24)**: error codes `CANNOT_DISABLE_SELF`, `DISBURSED_AMOUNT_REQUIRED`, `INVALID_COMMISSION_STATUS`; commission approve/cancel rules; webhook partner scoping and partner config; socket disconnect on token expiry; notification `data` shapes.
- v0.3 (2026-11-24): machine-readable `code` on business errors; lead business rules (duplicate open lead, 422 cases, concurrent update, assign rules, CCCD format); `LeadActivity.assignee`; `assignedStaffId=none`; `q` is case- and accent-insensitive; `sort` whitelist; CSV export rules.
- v0.2 (2026-11-24): disabled accounts get 403; logout always 204; unknown body properties → 400; phone/email normalization; `expiresIn` in token responses; refresh tokens are single-use (clients must single-flight refresh); date-range and timezone rules; new `GET /staff`; new `PATCH /auth/me` (planned for M4); decision-record naming.
- v0.1 (2026-11-24): first version.

## Conventions
- Base URL: `/api/v1`. JSON only. Timestamps: ISO 8601 UTC strings. Money: VND as integer (no decimals). IDs: UUID strings.
- Auth: `Authorization: Bearer <accessToken>`. Access token 15 min; refresh token 7 days, sent in the body of `/auth/refresh`, rotated on every use.
- Refresh tokens are **single-use**: reusing a rotated token revokes the whole session family. Two parallel refreshes with the same token → the second gets 401, so clients must run refresh as a single in-flight request.
- Request bodies are strict: an unknown property → 400 (`property x should not exist`).
- Normalization: phone numbers are accepted as `0…` or `+84…` with spaces/dots and are stored and returned as `0XXXXXXXXX`; emails are trimmed and lower-cased.
- Date ranges: `from` / `to` query params are ISO 8601 datetimes (UTC `Z` or with an offset). The range is half-open: `from` inclusive, `to` exclusive. Clients convert Vietnam calendar days to these bounds. `month=YYYY-MM` and any per-day bucket (e.g. `leadsPerDay[].date`, `YYYY-MM-DD`) use the `Asia/Ho_Chi_Minh` calendar.
- Decision records: `docs/decisions/NNN-api-*.md` and `NNN-web-*.md`, each side with its own numbering.
- Pagination query: `page` (default 1), `pageSize` (default 20, max 100). Paginated response:
  ```json
  { "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 134 } }
  ```
- Errors:
  ```json
  { "statusCode": 400, "error": "Bad Request", "message": "Validation failed", "details": [{ "field": "customerPhone", "message": "must be a valid VN phone number" }] }
  ```
  Codes used: 400 validation, 401 not logged in / bad token, 403 wrong role or not owner, 404, 409 conflict (e.g. invalid status transition, duplicate email), 422 business rule, 429 rate limit.
- Business errors (403 disabled account, 409, 422) also carry a machine-readable `code` so the web can show its own Vietnamese message: `ACCOUNT_DISABLED`, `EMAIL_TAKEN`, `DUPLICATE_LEAD`, `INVALID_TRANSITION`, `CONCURRENT_UPDATE`, `PRODUCT_UNAVAILABLE`, `AMOUNT_NOT_ALLOWED`, `ASSIGNEE_NOT_STAFF`, `CANNOT_DISABLE_SELF` (422, an admin disabling their own account), `DISBURSED_AMOUNT_REQUIRED` (422, webhook `DISBURSED` without an amount), `INVALID_COMMISSION_STATUS` (409, approve/cancel from the wrong status). The OpenAPI enum `ErrorCode` lists them all. Example: `{ "statusCode": 409, "error": "Conflict", "code": "DUPLICATE_LEAD", "message": "This customer already has an open lead for this product" }`.
- Roles: `ADMIN`, `STAFF`, `AFFILIATE`. "Owner" = the affiliate who created the lead.

## Enums
- `Role`: `ADMIN | STAFF | AFFILIATE`
- `UserStatus`: `ACTIVE | DISABLED`
- `ProductCategory`: `LOAN | CREDIT_CARD | INSURANCE`
- `CommissionType`: `PERCENT | FIXED` (PERCENT value in basis points: 150 = 1.5%; FIXED value in VND)
- `LeadStatus`: `NEW | CONTACTED | SUBMITTED | APPROVED | DISBURSED | REJECTED`
- `CommissionStatus`: `PENDING | APPROVED | PAID | CANCELLED`
- `PayoutStatus`: `DRAFT | CONFIRMED | PAID`
- `NotificationType`: `LEAD_STATUS_CHANGED | COMMISSION_CREATED | PAYOUT_PAID | LEAD_ASSIGNED`

Allowed lead transitions: `NEW→CONTACTED`, `CONTACTED→SUBMITTED`, `SUBMITTED→APPROVED`, `APPROVED→DISBURSED`, and any open status (`NEW|CONTACTED|SUBMITTED|APPROVED`) → `REJECTED`. Anything else → 409.

## Types
```ts
type User = { id: string; email: string; fullName: string; phone: string; role: Role; status: UserStatus; createdAt: string };
type AffiliateProfile = { userId: string; referralCode: string; bankName: string | null; bankAccountMasked: string | null };
type Me = User & { affiliate?: AffiliateProfile };

type Product = { id: string; name: string; partnerName: string; category: ProductCategory;
  commissionType: CommissionType; commissionValue: number; active: boolean; createdAt: string };

type Lead = { id: string; code: string;            // human-friendly, e.g. "LD-000123"
  affiliate: { id: string; fullName: string; referralCode: string };
  product: { id: string; name: string; partnerName: string };
  customerName: string;
  customerPhone: string;                             // masked for AFFILIATE
  customerNationalId: string | null;                 // masked for AFFILIATE
  requestedAmount: number | null;                    // VND, loans only
  disbursedAmount: number | null;                    // VND, set when DISBURSED
  status: LeadStatus;
  assignedStaff: { id: string; fullName: string } | null;
  createdAt: string; updatedAt: string };

type LeadActivity = { id: string; leadId: string; type: "CREATED" | "STATUS_CHANGED" | "ASSIGNED" | "NOTE" | "WEBHOOK";
  fromStatus: LeadStatus | null; toStatus: LeadStatus | null; note: string | null;
  actor: { id: string; fullName: string } | null;    // null when from partner webhook
  assignee: { id: string; fullName: string } | null; // set on ASSIGNED, else null
  createdAt: string };

type Commission = { id: string; lead: { id: string; code: string; customerName: string };
  affiliate: { id: string; fullName: string }; amount: number; status: CommissionStatus;
  payoutId: string | null; createdAt: string };

type Payout = { id: string; affiliate: { id: string; fullName: string }; periodMonth: string; // "2026-11"
  totalAmount: number; commissionCount: number; status: PayoutStatus; paidAt: string | null; createdAt: string };

type Notification = { id: string; type: NotificationType; title: string; body: string;
  data: Record<string, string>;                      // e.g. { leadId, status }
  readAt: string | null; createdAt: string };
```

## Endpoints

### Auth
| Method & path | Who | Body / query | Response |
|---|---|---|---|
| `POST /auth/register` | public | `{email, password (≥8), fullName, phone}` | `201 {user: Me, accessToken, refreshToken, expiresIn}` (role AFFILIATE, referral code generated) |
| `POST /auth/login` | public | `{email, password}` | `200 {user: Me, accessToken, refreshToken, expiresIn}`; wrong credentials → 401; `DISABLED` account → 403 "Account is disabled" |
| `POST /auth/refresh` | public | `{refreshToken}` | `200 {accessToken, refreshToken, expiresIn}`; invalid/reused token → 401; `DISABLED` account → 403 |
| `POST /auth/logout` | any | `{refreshToken}` | always `204` (unknown or foreign token is ignored, nothing leaked) |
| `GET /auth/me` | any | – | `200 Me` |
| `PATCH /auth/me` *(planned M4)* | any | `{fullName?, phone?, bankName?, bankAccountNumber?}` (bank fields AFFILIATE only, else 403) | `200 Me` (bank account returned only as `bankAccountMasked`, last 4 digits visible) |

`expiresIn` = seconds until the access token expires (900).

### Products
| `GET /products` | any | `?active=true&category=` | `200 Product[]` (affiliates see active only) |
|---|---|---|---|
| `POST /products` | ADMIN | `{name, partnerName, category, commissionType, commissionValue, active?}` | `201 Product` |
| `PATCH /products/:id` | ADMIN | partial of the above | `200 Product` |

### Leads
| `GET /leads` | any | `?status=&productId=&affiliateId=&assignedStaffId=&q=&from=&to=&page=&pageSize=&sort=createdAt:desc` | `200 Paginated<Lead>` (AFFILIATE: own leads only, `affiliateId` ignored) |
|---|---|---|---|
| `POST /leads` | AFFILIATE | `{productId, customerName, customerPhone, customerNationalId?, requestedAmount?, note?}` | `201 Lead` |
| `GET /leads/:id` | owner, STAFF, ADMIN | – | `200 Lead` |
| `PATCH /leads/:id/status` | STAFF, ADMIN | `{status, note?, disbursedAmount?}` (`disbursedAmount` required when `DISBURSED`) | `200 Lead`; 409 on invalid transition |
| `PATCH /leads/:id/assign` | STAFF, ADMIN | `{staffId}` | `200 Lead` |
| `POST /leads/:id/notes` | STAFF, ADMIN | `{note}` | `201 LeadActivity` |
| `GET /leads/:id/activities` | owner, STAFF, ADMIN | – | `200 LeadActivity[]` (newest first; affiliates do not see NOTE entries) |
| `GET /leads/export.csv` | ADMIN | same filters as `GET /leads` (page/pageSize ignored) | `200 text/csv` (Vietnamese column headers, times in Vietnam time) |

Lead query rules:
- `assignedStaffId=none` returns leads nobody has been assigned.
- `q` matches the customer name (case- and accent-insensitive: "nguyen" matches "Nguyễn"), the lead code (`LD-000123`), or 3+ digits of the phone number.
- `sort` accepts `createdAt|updatedAt|requestedAmount|disbursedAmount` with `:asc|:desc`; anything else → 400.

Lead business rules:
- One open lead (`NEW…APPROVED`) per (product, customer phone), across all affiliates. A duplicate → 409 `DUPLICATE_LEAD` with a generic message (it never reveals who owns the other lead). Once the old lead is `REJECTED` or `DISBURSED`, a new one is allowed.
- Create: unknown or inactive product → 422 `PRODUCT_UNAVAILABLE`; `requestedAmount` on a non-LOAN product → 422 `AMOUNT_NOT_ALLOWED`. `customerNationalId` (CCCD) is 9 or 12 digits.
- Status change: `disbursedAmount` (integer ≥ 0) is required for `DISBURSED` and rejected (400) for any other status. Invalid step → 409 `INVALID_TRANSITION` (message lists the allowed next steps). Two users changing the same lead at once → the later one gets 409 `CONCURRENT_UPDATE`.
- Assign: `staffId` must be an ACTIVE STAFF or ADMIN, else 422 `ASSIGNEE_NOT_STAFF`. Re-assigning to the current assignee is a no-op (no activity).

### Commissions & payouts
| `GET /commissions` | any | `?status=&affiliateId=&month=YYYY-MM&page=&pageSize=` | `200 Paginated<Commission>` (AFFILIATE: own only) |
|---|---|---|---|
| `GET /commissions/summary` | AFFILIATE | – | `200 {pending, approved, paid, totalLeads, disbursedLeads}` (amounts in VND) |
| `PATCH /commissions/:id/approve` | ADMIN | – | `200 Commission` (PENDING → APPROVED; otherwise 409 `INVALID_COMMISSION_STATUS`) |
| `PATCH /commissions/:id/cancel` | ADMIN | `{reason}` | `200 Commission` (only from `PENDING` or `APPROVED` and not yet in a payout; otherwise 409 `INVALID_COMMISSION_STATUS`) |
| `GET /payouts` | any | `?status=&month=&affiliateId=&page=&pageSize=` | `200 Paginated<Payout>` (AFFILIATE: own only) |
| `POST /payouts/generate` | ADMIN | `{month: "YYYY-MM"}` | `202 {jobId}` (BullMQ job; creates DRAFT payouts from APPROVED commissions) |
| `PATCH /payouts/:id/confirm` | ADMIN | – | `200 Payout` (DRAFT → CONFIRMED) |
| `PATCH /payouts/:id/mark-paid` | ADMIN | – | `200 Payout` (CONFIRMED → PAID; commissions → PAID; notifies affiliate) |

### Reports (STAFF, ADMIN)
| `GET /reports/overview` | `?from=&to=` | `200 {leadsByStatus: Record<LeadStatus, number>, conversionRate: number /* DISBURSED ÷ all, 0..1 */, disbursedAmount: number, commissionByStatus: Record<CommissionStatus, number>, leadsPerDay: {date: string, count: number}[]}` |
|---|---|---|
| `GET /reports/top-affiliates` | `?from=&to=&limit=10` | `200 {affiliate: {id, fullName, referralCode}, leads: number, disbursed: number, commission: number}[]` |

### Notifications
| `GET /notifications` | any | `?unread=true&page=&pageSize=` | `200 Paginated<Notification> & {unreadCount: number}` |
|---|---|---|---|
| `PATCH /notifications/:id/read` | owner | – | `200 Notification` |
| `PATCH /notifications/read-all` | any | – | `204` |

### Staff directory (STAFF, ADMIN)
| `GET /staff` | – | `200 {id: string, fullName: string, role: "STAFF" | "ADMIN"}[]` — active STAFF and ADMIN users who can be assigned leads, sorted by fullName |
|---|---|---|

### Users (ADMIN)
| `GET /users` | `?role=&status=&q=&page=&pageSize=` | `200 Paginated<User>` |
|---|---|---|
| `POST /users` | `{email, password, fullName, phone, role: "STAFF" | "ADMIN"}` | `201 User` |
| `PATCH /users/:id` | `{status?, fullName?, phone?}` | `200 User` |

### Partner webhook
`POST /webhooks/partner-status` — public, signed.
- Headers: `X-Partner-Id`, `X-Timestamp` (unix seconds), `X-Signature` = hex HMAC-SHA256 of `${timestamp}.${rawBody}` with the partner secret.
- Body: `{eventId, leadCode, status: "APPROVED" | "REJECTED" | "DISBURSED", disbursedAmount?, note?}`
- Responses: `200 {ok: true}`; repeated `eventId` → `200 {ok: true, duplicate: true}`; bad signature or timestamp more than 5 min off → 401; unknown lead **or a lead of another partner's product** → 404 (same response, nothing leaked); invalid body after a valid signature (incl. unknown properties) → 400; `DISBURSED` without `disbursedAmount` → 422 `DISBURSED_AMOUNT_REQUIRED`; invalid transition → 409.
- Partners are configured by the env var `PARTNER_WEBHOOKS` (JSON `[{id, name, secret}]`); `name` must equal `Product.partnerName`, and a partner can only update leads of its own products. A `Partner` table with admin screens is future work.

### Health
`GET /health` → `200 {status: "ok", db: "up", redis: "up"}`

## Realtime (Socket.IO)
- Namespace `/realtime`, path `/socket.io`. Client connects with `auth: { token: accessToken }`; invalid token → connection refused.
- The server joins each socket to rooms `user:<userId>` and `role:<ROLE>`.
- Server → client events:
  - `notification:new` → `Notification`
  - `lead:updated` → `{leadId: string, status: LeadStatus, updatedAt: string}` (sent to the owner and to `role:STAFF`, `role:ADMIN`)
  - `payout:updated` → `{payoutId: string, status: PayoutStatus}`
- No client → server events.
- When the access token expires, the server disconnects the socket (`disconnect` reason `io server disconnect`). The client refreshes its token, then reconnects with the new one.
- Notification `data` is always a string map:
  - `LEAD_STATUS_CHANGED`: `{leadId, leadCode, status}`
  - `LEAD_ASSIGNED`: `{leadId, leadCode}`
  - `COMMISSION_CREATED`: `{commissionId, leadId, leadCode, amount}` (`amount` is a numeric string, VND)
  - `PAYOUT_PAID`: `{payoutId, periodMonth, totalAmount}` (defined in M4)

## Seed data (for dev and demo)
- `admin@demo.vn`, `staff@demo.vn`, `ctv1@demo.vn` … `ctv3@demo.vn`, all with password `Demo@12345`.
- 6 products across the 3 categories with both commission types; about 120 leads spread over the last 60 days in every status; matching commissions and one paid payout.
