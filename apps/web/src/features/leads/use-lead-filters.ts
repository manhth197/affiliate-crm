import { LEAD_STATUSES, type LeadQuery } from '@/api/types'
import { vnDayRange } from '@/lib/dates'
import { useUrlState } from '@/lib/use-url-state'

export const LEADS_PAGE_SIZE = 20

/** Read the leads filters from the URL and turn them into an API query. */
export function useLeadFilters() {
  const url = useUrlState()
  // Unknown values in a hand-edited URL are ignored rather than sent to the API.
  const status = LEAD_STATUSES.find((value) => value === url.get('status'))
  const filters = {
    q: url.get('q'),
    status: status ?? '',
    productId: url.get('productId'),
    fromDay: url.get('from'),
    toDay: url.get('to'),
  }

  const query: LeadQuery = {
    page: url.page,
    pageSize: LEADS_PAGE_SIZE,
    sort: 'createdAt:desc',
    q: filters.q || undefined,
    status,
    productId: filters.productId || undefined,
    // The user picks Vietnam calendar days; the API wants a half-open ISO range.
    ...vnDayRange(filters.fromDay || undefined, filters.toDay || undefined),
  }

  const hasFilters = Object.values(filters).some(Boolean)
  return { filters, query, hasFilters, page: url.page, update: url.update }
}
