import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

/** After any finance change, refetch every finance list and summary on screen. */
function useFinanceMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: financeKeys.all }),
  })
}

export const useApproveCommission = () => useFinanceMutation(financeApi.approveCommission)

export const useCancelCommission = () =>
  useFinanceMutation(({ id, reason }: { id: string; reason: string }) =>
    financeApi.cancelCommission(id, { reason }),
  )

export const useConfirmPayout = () => useFinanceMutation(financeApi.confirmPayout)

export const useMarkPayoutPaid = () => useFinanceMutation(financeApi.markPayoutPaid)

/**
 * Payout generation is a background job (202). The list is refetched a few times while the job
 * runs; `payout:updated` events refresh it too when realtime is connected.
 */
export function useGeneratePayouts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: financeApi.generatePayouts,
    onSuccess: () => {
      for (const delay of [1500, 4000, 8000]) {
        setTimeout(() => void queryClient.invalidateQueries({ queryKey: financeKeys.all }), delay)
      }
    },
  })
}
