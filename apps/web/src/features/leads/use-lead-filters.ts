import { LEAD_STATUSES, type LeadQuery } from '@/api/types'
import { vnDayRange } from '@/lib/dates'
import { useUrlState } from '@/lib/use-url-state'

export const LEADS_PAGE_SIZE = 20

export type PipelineView = 'kanban' | 'table'

/**
 * Read the lead filters from the URL and turn them into an API query.
 * `assignee` (back office): "" = everyone, "me", "none" (unassigned) or a staff id.
 */
export function useLeadFilters({ currentUserId }: { currentUserId?: string } = {}) {
  const url = useUrlState()
  // Unknown values in a hand-edited URL are ignored rather than sent to the API.
  const status = LEAD_STATUSES.find((value) => value === url.get('status'))
  const assignee = url.get('assignee')
  const view: PipelineView = url.get('view') === 'table' ? 'table' : 'kanban'
  const filters = {
    q: url.get('q'),
    status: status ?? '',
    productId: url.get('productId'),
    assignee,
    fromDay: url.get('from'),
    toDay: url.get('to'),
  }

  const assignedStaffId = assignee === 'me' ? currentUserId : assignee || undefined

  /** Filters shared by every view (kanban columns add their own status). */
  const baseQuery: LeadQuery = {
    q: filters.q || undefined,
    productId: filters.productId || undefined,
    assignedStaffId,
    // The user picks Vietnam calendar days; the API wants a half-open ISO range.
    ...vnDayRange(filters.fromDay || undefined, filters.toDay || undefined),
  }

  const query = {
    ...baseQuery,
    status,
    page: url.page,
    pageSize: LEADS_PAGE_SIZE,
    sort: 'createdAt:desc',
  } satisfies LeadQuery

  const hasFilters = Object.values(filters).some(Boolean)
  return { filters, baseQuery, query, view, hasFilters, page: url.page, update: url.update }
}
