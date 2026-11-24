import { apiRequest } from './client'
import type {
  CancelCommissionRequest,
  Commission,
  CommissionStatus,
  CommissionSummary,
  PageQuery,
  Paginated,
  JobAccepted,
  Payout,
  PayoutStatus,
} from './types'

export type CommissionQuery = PageQuery & {
  status?: CommissionStatus
  affiliateId?: string
  /** "YYYY-MM", Vietnam calendar */
  month?: string
}

export type PayoutQuery = PageQuery & {
  status?: PayoutStatus
  affiliateId?: string
  month?: string
}

export const financeApi = {
  commissions: (query: CommissionQuery, signal?: AbortSignal) =>
    apiRequest<Paginated<Commission>>('/commissions', { query, signal }),

  /** AFFILIATE only. */
  commissionSummary: (signal?: AbortSignal) =>
    apiRequest<CommissionSummary>('/commissions/summary', { signal }),

  payouts: (query: PayoutQuery, signal?: AbortSignal) =>
    apiRequest<Paginated<Payout>>('/payouts', { query, signal }),

  // ---- ADMIN ----
  /** PENDING → APPROVED; 409 INVALID_COMMISSION_STATUS otherwise. */
  approveCommission: (id: string) =>
    apiRequest<Commission>(`/commissions/${encodeURIComponent(id)}/approve`, { method: 'PATCH' }),

  /** From PENDING/APPROVED and not in a payout; 409 INVALID_COMMISSION_STATUS otherwise. */
  cancelCommission: (id: string, body: CancelCommissionRequest) =>
    apiRequest<Commission>(`/commissions/${encodeURIComponent(id)}/cancel`, {
      method: 'PATCH',
      body,
    }),

  /** 202: a background job creates/recalculates DRAFT payouts for the month. */
  generatePayouts: (month: string) =>
    apiRequest<JobAccepted>('/payouts/generate', { method: 'POST', body: { month } }),

  /** DRAFT → CONFIRMED; 409 INVALID_PAYOUT_STATUS otherwise. */
  confirmPayout: (id: string) =>
    apiRequest<Payout>(`/payouts/${encodeURIComponent(id)}/confirm`, { method: 'PATCH' }),

  /** CONFIRMED → PAID (commissions become PAID, the affiliate is notified). */
  markPayoutPaid: (id: string) =>
    apiRequest<Payout>(`/payouts/${encodeURIComponent(id)}/mark-paid`, { method: 'PATCH' }),
}
