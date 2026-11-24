import {
  keepPreviousData,
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { leadsApi } from '@/api/leads'
import type { ChangeLeadStatusRequest, Lead, LeadQuery, LeadStatus, Paginated } from '@/api/types'
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

/**
 * Optimistically move a lead between cached lists (e.g. kanban columns): remove it from lists
 * filtered on its old status, add it to lists filtered on the new one, update it in place in
 * unfiltered lists. Returns the previous cache entries for rollback.
 */
function moveLeadInLists(queryClient: QueryClient, lead: Lead, status: LeadStatus) {
  const snapshot = queryClient.getQueriesData<Paginated<Lead>>({ queryKey: leadKeys.lists() })
  const moved: Lead = { ...lead, status, updatedAt: new Date().toISOString() }

  for (const [key, page] of snapshot) {
    if (!page) continue
    const query = (key[2] ?? {}) as LeadQuery
    const inPage = page.data.some((l) => l.id === lead.id)
    let next = page
    if (query.status === lead.status && inPage) {
      next = {
        data: page.data.filter((l) => l.id !== lead.id),
        meta: { ...page.meta, total: page.meta.total - 1 },
      }
    } else if (query.status === status && !inPage) {
      next = { data: [moved, ...page.data], meta: { ...page.meta, total: page.meta.total + 1 } }
    } else if (!query.status && inPage) {
      next = { ...page, data: page.data.map((l) => (l.id === lead.id ? moved : l)) }
    }
    if (next !== page) queryClient.setQueryData(key, next)
  }
  return snapshot
}

type ChangeStatusVariables = { lead: Lead; body: ChangeLeadStatusRequest }
type ChangeStatusContext = { snapshot: [QueryKey, Paginated<Lead> | undefined][] }

/**
 * Change a lead's status (STAFF/ADMIN). Lists update immediately (optimistic), roll back on
 * error, and everything touched is refetched afterwards, so a 409 (someone else changed the
 * lead first) ends with the latest server state on screen.
 */
export function useChangeLeadStatus() {
  const queryClient = useQueryClient()
  return useMutation<Lead, unknown, ChangeStatusVariables, ChangeStatusContext>({
    mutationFn: ({ lead, body }) => leadsApi.changeStatus(lead.id, body),
    onMutate: async ({ lead, body }) => {
      await queryClient.cancelQueries({ queryKey: leadKeys.lists() })
      return { snapshot: moveLeadInLists(queryClient, lead, body.status) }
    },
    onError: (_error, _variables, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(leadKeys.detail(updated.id), updated)
    },
    onSettled: (_data, _error, { lead }) => {
      void queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: leadKeys.detail(lead.id) })
      // A DISBURSED lead creates a commission.
      void queryClient.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

export function useAssignLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, staffId }: { leadId: string; staffId: string }) =>
      leadsApi.assign(leadId, { staffId }),
    onSuccess: (updated) => {
      queryClient.setQueryData(leadKeys.detail(updated.id), updated)
      void queryClient.invalidateQueries({ queryKey: leadKeys.activities(updated.id) })
      void queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
    },
  })
}

export function useAddLeadNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ leadId, note }: { leadId: string; note: string }) =>
      leadsApi.addNote(leadId, { note }),
    onSuccess: (_activity, { leadId }) => {
      void queryClient.invalidateQueries({ queryKey: leadKeys.activities(leadId) })
    },
  })
}
