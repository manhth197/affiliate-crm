import { apiRequest } from './client'
import type { ReportsOverview, TopAffiliate } from './types'

/** ISO datetimes, half-open [from, to); without them the API uses the last 30 Vietnam days. */
export type ReportRange = { from?: string; to?: string }

/** STAFF/ADMIN. */
export const reportsApi = {
  overview: (range: ReportRange, signal?: AbortSignal) =>
    apiRequest<ReportsOverview>('/reports/overview', { query: range, signal }),

  topAffiliates: (range: ReportRange & { limit?: number }, signal?: AbortSignal) =>
    apiRequest<TopAffiliate[]>('/reports/top-affiliates', { query: range, signal }),
}
