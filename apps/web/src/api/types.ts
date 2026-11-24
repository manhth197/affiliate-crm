/**
 * Types for the Affiliate CRM API (contract v0.5).
 *
 * - Everything the API already exports in `docs/openapi.json` comes from the generated
 *   `schema.gen.ts` (regenerate with `npm run gen:api`), so a change in the API breaks our build
 *   instead of production.
 * - Only query-string and realtime types are written by hand (OpenAPI does not describe
 *   query objects as schemas, nor Socket.IO events).
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

/** Machine-readable code on business errors (403 disabled account, 409, 422). */
export type ApiErrorCode = Schemas['ErrorCode']
export type ApiErrorBody = Schemas['ErrorResponse']
export type LeadActivity = Schemas['LeadActivity']

export type CommissionStatus = Schemas['CommissionStatus']
export type Commission = Schemas['Commission']
export type CommissionSummary = Schemas['CommissionSummary']
export type CancelCommissionRequest = Schemas['CancelCommissionRequest']

export type PayoutStatus = Schemas['PayoutStatus']
export type Payout = Schemas['Payout']
export type GeneratePayoutsRequest = Schemas['GeneratePayoutsRequest']
export type JobAccepted = Schemas['JobAccepted']

export type ReportsOverview = Schemas['ReportOverview']
export type TopAffiliate = Schemas['TopAffiliate']

export type UpdateMeRequest = Schemas['UpdateMeRequest']

export type NotificationType = Schemas['NotificationType']
export type Notification = Schemas['Notification']
export type NotificationPage = Schemas['PaginatedNotifications']

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
