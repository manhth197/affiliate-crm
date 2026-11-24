import { apiRequest } from './client'
import type {
  Commission,
  CommissionStatus,
  CommissionSummary,
  PageQuery,
  Paginated,
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
}
