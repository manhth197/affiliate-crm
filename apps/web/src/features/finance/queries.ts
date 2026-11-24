import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { type CommissionQuery, financeApi, type PayoutQuery } from '@/api/finance'

export const financeKeys = {
  all: ['finance'] as const,
  summary: () => [...financeKeys.all, 'commission-summary'] as const,
  commissions: (query: CommissionQuery) => [...financeKeys.all, 'commissions', query] as const,
  payouts: (query: PayoutQuery) => [...financeKeys.all, 'payouts', query] as const,
}

/** AFFILIATE only (the endpoint answers 403 to other roles). */
export function useCommissionSummary({ enabled = true } = {}) {
  return useQuery({
    queryKey: financeKeys.summary(),
    queryFn: ({ signal }) => financeApi.commissionSummary(signal),
    enabled,
  })
}

export function useCommissions(query: CommissionQuery) {
  return useQuery({
    queryKey: financeKeys.commissions(query),
    queryFn: ({ signal }) => financeApi.commissions(query, signal),
    placeholderData: keepPreviousData,
  })
}

export function usePayouts(query: PayoutQuery) {
  return useQuery({
    queryKey: financeKeys.payouts(query),
    queryFn: ({ signal }) => financeApi.payouts(query, signal),
    placeholderData: keepPreviousData,
  })
}
