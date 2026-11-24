/**
 * Types for the Affiliate CRM API (contract v0.2).
 *
 * - Endpoints already in `docs/openapi.json` use the generated types from `schema.gen.ts`
 *   (regenerate with `npm run gen:api`), so a change in the API's OpenAPI export breaks the build.
 * - Everything else is written by hand from `docs/api-contract.md` until the API exports it.
 */
import type { components } from './schema.gen'

type Schemas = components['schemas']

// ---- Generated from docs/openapi.json ----
export type Role = Schemas['Role']
export type UserStatus = Schemas['UserStatus']
export type AffiliateProfile = Schemas['AffiliateProfile']
export type Me = Schemas['Me']
export type User = Omit<Me, 'affiliate'>
export type LoginRequest = Schemas['LoginRequest']
export type RegisterRequest = Schemas['RegisterRequest']
export type ApiErrorBody = Schemas['ErrorResponse']
export type Health = Schemas['Health']
/**
 * Contract v0.2 adds `expiresIn` (seconds until the access token expires); the current
 * OpenAPI export does not have it yet, so it is optional here.
 */
export type TokenPair = Schemas['TokenPair'] & { expiresIn?: number }
export type AuthResponse = Schemas['AuthResponse'] & { expiresIn?: number }

// ---- Enums ----
export const ROLES = ['ADMIN', 'STAFF', 'AFFILIATE'] as const satisfies readonly Role[]

export type ProductCategory = 'LOAN' | 'CREDIT_CARD' | 'INSURANCE'
/** PERCENT value is in basis points (150 = 1.5%); FIXED value is in VND. */
export type CommissionType = 'PERCENT' | 'FIXED'

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'SUBMITTED',
  'APPROVED',
  'DISBURSED',
  'REJECTED',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED'
export type PayoutStatus = 'DRAFT' | 'CONFIRMED' | 'PAID'
export type NotificationType =
  'LEAD_STATUS_CHANGED' | 'COMMISSION_CREATED' | 'PAYOUT_PAID' | 'LEAD_ASSIGNED'
export type LeadActivityType = 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'NOTE' | 'WEBHOOK'

/** Allowed lead transitions (anything else is a 409 from the API). */
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

export type Paginated<T> = {
  data: T[]
  meta: { page: number; pageSize: number; total: number }
}

export type PageQuery = { page?: number; pageSize?: number }

// ---- Entities (hand-written) ----
export type Product = {
  id: string
  name: string
  partnerName: string
  category: ProductCategory
  commissionType: CommissionType
  commissionValue: number
  active: boolean
  createdAt: IsoDateString
}

export type Lead = {
  id: string
  /** Human-friendly code, e.g. "LD-000123". */
  code: string
  affiliate: { id: string; fullName: string; referralCode: string }
  product: { id: string; name: string; partnerName: string }
  customerName: string
  /** Masked for AFFILIATE. */
  customerPhone: string
  /** Masked for AFFILIATE. */
  customerNationalId: string | null
  /** VND, loans only. */
  requestedAmount: number | null
  /** VND, set when DISBURSED. */
  disbursedAmount: number | null
  status: LeadStatus
  assignedStaff: { id: string; fullName: string } | null
  createdAt: IsoDateString
  updatedAt: IsoDateString
}

export type LeadActivity = {
  id: string
  leadId: string
  type: LeadActivityType
  fromStatus: LeadStatus | null
  toStatus: LeadStatus | null
  note: string | null
  /** null when the change came from the partner webhook. */
  actor: { id: string; fullName: string } | null
  createdAt: IsoDateString
}

export type Commission = {
  id: string
  lead: { id: string; code: string; customerName: string }
  affiliate: { id: string; fullName: string }
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
  affiliate: { id: string; fullName: string }
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

/** `GET /staff`: active STAFF and ADMIN users who can be assigned leads. */
export type StaffMember = { id: string; fullName: string; role: 'STAFF' | 'ADMIN' }

// ---- Request bodies / queries (used from M2 on) ----
export type LeadQuery = PageQuery & {
  status?: LeadStatus
  productId?: string
  affiliateId?: string
  assignedStaffId?: string
  q?: string
  from?: string
  to?: string
  sort?: string
}

export type CreateLeadRequest = {
  productId: string
  customerName: string
  customerPhone: string
  customerNationalId?: string
  requestedAmount?: number
  note?: string
}

export type ChangeLeadStatusRequest = {
  status: LeadStatus
  note?: string
  /** Required when status is DISBURSED. */
  disbursedAmount?: number
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
