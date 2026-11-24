import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { type ReportRange, reportsApi } from '@/api/reports'
import {
  type CommissionStatus,
  LEAD_STATUSES,
  type LeadStatus,
  type ReportsOverview,
} from '@/api/types'

export const reportKeys = {
  all: ['reports'] as const,
  overview: (range: ReportRange) => [...reportKeys.all, 'overview', range] as const,
  top: (range: ReportRange) => [...reportKeys.all, 'top-affiliates', range] as const,
}

const COMMISSION_STATUSES: CommissionStatus[] = ['PENDING', 'APPROVED', 'PAID', 'CANCELLED']

/** The overview with every status present (0 when missing). */
export type OverviewView = Omit<ReportsOverview, 'leadsByStatus' | 'commissionByStatus'> & {
  leadsByStatus: Record<LeadStatus, number>
  commissionByStatus: Record<CommissionStatus, number>
}

/**
 * The contract says both maps always have every key, but the OpenAPI export marks them
 * optional; fill the gaps so the page never shows `undefined`.
 */
export function toOverviewView(data: ReportsOverview): OverviewView {
  const zero = <K extends string>(keys: readonly K[]) =>
    Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  return {
    ...data,
    leadsByStatus: { ...zero(LEAD_STATUSES), ...data.leadsByStatus },
    commissionByStatus: { ...zero(COMMISSION_STATUSES), ...data.commissionByStatus },
  }
}

export function useReportOverview(range: ReportRange) {
  return useQuery({
    queryKey: reportKeys.overview(range),
    queryFn: ({ signal }) => reportsApi.overview(range, signal),
    select: toOverviewView,
    placeholderData: keepPreviousData,
  })
}

export function useTopAffiliates(range: ReportRange) {
  return useQuery({
    queryKey: reportKeys.top(range),
    queryFn: ({ signal }) => reportsApi.topAffiliates({ ...range, limit: 10 }, signal),
    placeholderData: keepPreviousData,
  })
}
