/**
 * Types for the Affiliate CRM API (contract v0.3).
 *
 * - Everything the API already exports in `docs/openapi.json` comes from the generated
 *   `schema.gen.ts` (regenerate with `npm run gen:api`), so a change in the API breaks our build
 *   instead of production.
 * - The rest (commissions, payouts, notifications, reports) is written by hand from
 *   `docs/api-contract.md` until the API exports it.
 * - Where the contract is ahead of the current export, the extra field is added as optional and
 *   marked "contract v0.3".
 */
import type { components } from './schema.gen'

type Schemas = components['schemas']

// ---- Generated from docs/openapi.json ----
export type Role = Schemas['Role']
export type UserStatus = Schemas['UserStatus']
export type AffiliateProfile = Schemas['AffiliateProfile']
export type Me = Schemas['Me']
export type User = Schemas['User']
export type UserRef = Schemas['UserRef']
export type StaffMember = Schemas['StaffMember']
export type LoginRequest = Schemas['LoginRequest']
export type RegisterRequest = Schemas['RegisterRequest']
export type TokenPair = Schemas['TokenPair']
export type AuthResponse = Schemas['AuthResponse']
export type Health = Schemas['Health']

export type ProductCategory = Schemas['ProductCategory']
/** PERCENT value is in basis points (150 = 1.5%); FIXED value is in VND. */
export type CommissionType = Schemas['CommissionType']
export type Product = Schemas['Product']

export type LeadStatus = Schemas['LeadStatus']
export type LeadActivityType = Schemas['LeadActivityType']
export type Lead = Schemas['Lead']
export type CreateLeadRequest = Schemas['CreateLeadRequest']
export type ChangeLeadStatusRequest = Schemas['ChangeLeadStatusRequest']
export type AssignLeadRequest = Schemas['AssignLeadRequest']
export type AddLeadNoteRequest = Schemas['AddLeadNoteRequest']

/** Contract v0.3: business errors carry a machine-readable `code`. */
export type ApiErrorCode =
  | 'ACCOUNT_DISABLED'
  | 'EMAIL_TAKEN'
  | 'DUPLICATE_LEAD'
  | 'INVALID_TRANSITION'
  | 'CONCURRENT_UPDATE'
  | 'PRODUCT_UNAVAILABLE'
  | 'AMOUNT_NOT_ALLOWED'
  | 'ASSIGNEE_NOT_STAFF'
export type ApiErrorBody = Schemas['ErrorResponse'] & { code?: ApiErrorCode | (string & {}) }

/**
 * Contract v0.3: `assignee` is set on ASSIGNED entries. The current export does not have it
 * yet (it puts the assignee's name in `note`), so it is optional here.
 */
export type LeadActivity = Schemas['LeadActivity'] & { assignee?: UserRef | null }

// ---- Enum values (checked against the generated unions) ----
export const ROLES = ['ADMIN', 'STAFF', 'AFFILIATE'] as const satisfies readonly Role[]
export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'SUBMITTED',
  'APPROVED',
  'DISBURSED',
  'REJECTED',
] as const satisfies readonly LeadStatus[]

export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED'
export type PayoutStatus = 'DRAFT' | 'CONFIRMED' | 'PAID'
export type NotificationType =
  'LEAD_STATUS_CHANGED' | 'COMMISSION_CREATED' | 'PAYOUT_PAID' | 'LEAD_ASSIGNED'

/** Allowed lead transitions (anything else is a 409 INVALID_TRANSITION from the API). */
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ['CONTACTED', 'REJECTED'],
  CONTACTED: ['SUBMITTED', 'REJECTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['DISBURSED', 'REJECTED'],
  DISBURSED: [],
  REJECTED: [],
}

// ---- Shared ----
/** ISO 8601 UTC string. */
export type IsoDateString = string

export type Paginated<T> = { data: T[]; meta: Schemas['PageMeta'] }

export type PageQuery = { page?: number; pageSize?: number }

// ---- Hand-written (not in the OpenAPI export yet) ----
export type Commission = {
  id: string
  lead: { id: string; code: string; customerName: string }
  affiliate: UserRef
  amount: number
  status: CommissionStatus
  payoutId: string | null
  createdAt: IsoDateString
}

export type CommissionSummary = {
  pending: number
  approved: number
  paid: number
  totalLeads: number
  disbursedLeads: number
}

export type Payout = {
  id: string
  affiliate: UserRef
  /** "YYYY-MM" */
  periodMonth: string
  totalAmount: number
  commissionCount: number
  status: PayoutStatus
  paidAt: IsoDateString | null
  createdAt: IsoDateString
}

export type Notification = {
  id: string
  type: NotificationType
  title: string
  body: string
  /** e.g. { leadId, status } */
  data: Record<string, string>
  readAt: IsoDateString | null
  createdAt: IsoDateString
}

export type NotificationPage = Paginated<Notification> & { unreadCount: number }

export type ReportsOverview = {
  leadsByStatus: Record<LeadStatus, number>
  /** DISBURSED ÷ all, 0..1 */
  conversionRate: number
  disbursedAmount: number
  commissionByStatus: Record<CommissionStatus, number>
  leadsPerDay: { date: string; count: number }[]
}

export type TopAffiliate = {
  affiliate: { id: string; fullName: string; referralCode: string }
  leads: number
  disbursed: number
  commission: number
}

// ---- Query strings ----
export type LeadSortField = 'createdAt' | 'updatedAt' | 'requestedAmount' | 'disbursedAmount'

export type LeadQuery = PageQuery & {
  status?: LeadStatus
  productId?: string
  affiliateId?: string
  /** A staff id, or "none" for unassigned leads (contract v0.3). */
  assignedStaffId?: string
  /** Name (case/accent-insensitive), lead code, or 3+ phone digits. */
  q?: string
  /** ISO datetime, inclusive. */
  from?: string
  /** ISO datetime, exclusive. */
  to?: string
  sort?: `${LeadSortField}:${'asc' | 'desc'}`
}

// ---- Realtime (Socket.IO, namespace /realtime) ----
export type ServerToClientEvents = {
  'notification:new': (notification: Notification) => void
  'lead:updated': (payload: {
    leadId: string
    status: LeadStatus
    updatedAt: IsoDateString
  }) => void
  'payout:updated': (payload: { payoutId: string; status: PayoutStatus }) => void
}
