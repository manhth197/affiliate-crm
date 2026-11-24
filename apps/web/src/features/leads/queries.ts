import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { leadsApi } from '@/api/leads'
import type { LeadQuery } from '@/api/types'
import { financeKeys } from '@/features/finance/queries'

/** Query keys in one place, so mutations can invalidate exactly what they change. */
export const leadKeys = {
  all: ['leads'] as const,
  lists: () => [...leadKeys.all, 'list'] as const,
  list: (query: LeadQuery) => [...leadKeys.lists(), query] as const,
  detail: (id: string) => [...leadKeys.all, 'detail', id] as const,
  activities: (id: string) => [...leadKeys.detail(id), 'activities'] as const,
}

export function useLeads(query: LeadQuery) {
  return useQuery({
    queryKey: leadKeys.list(query),
    queryFn: ({ signal }) => leadsApi.list(query, signal),
    // Keep showing the previous page while the next one loads (no table flicker).
    placeholderData: keepPreviousData,
  })
}

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: ({ signal }) => leadsApi.get(id, signal),
  })
}

export function useLeadActivities(id: string, { enabled = true } = {}) {
  return useQuery({
    queryKey: leadKeys.activities(id),
    queryFn: ({ signal }) => leadsApi.activities(id, signal),
    enabled,
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: leadsApi.create,
    onSuccess: (lead) => {
      queryClient.setQueryData(leadKeys.detail(lead.id), lead)
      void queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      // The dashboard summary counts leads too.
      void queryClient.invalidateQueries({ queryKey: financeKeys.summary() })
    },
  })
}
