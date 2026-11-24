import { http, HttpResponse } from 'msw'
import type { CommissionStatus, CommissionSummary, PayoutStatus } from '@/api/types'
import { vnMonth } from '@/lib/dates'
import { db } from '../db'
import { api, authenticate, latency } from '../http'
import { paginate, readQuery, withQueryErrors } from '../query'
import { toCommission, toPayout } from '../serialize'

const COMMISSION_STATUSES = [
  'PENDING',
  'APPROVED',
  'PAID',
  'CANCELLED',
] as const satisfies readonly CommissionStatus[]
const PAYOUT_STATUSES = ['DRAFT', 'CONFIRMED', 'PAID'] as const satisfies readonly PayoutStatus[]

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt)

export const financeHandlers = [
  http.get(api('/commissions/summary'), async ({ request }) => {
    await latency()
    const auth = authenticate(request, ['AFFILIATE'])
    if (auth.error) return auth.error
    const mine = db.commissions.filter((c) => c.affiliateId === auth.user.id)
    const sum = (status: CommissionStatus) =>
      mine.filter((c) => c.status === status).reduce((total, c) => total + c.amount, 0)
    const myLeads = db.leads.filter((l) => l.affiliateId === auth.user.id)

    return HttpResponse.json<CommissionSummary>({
      pending: sum('PENDING'),
      approved: sum('APPROVED'),
      paid: sum('PAID'),
      totalLeads: myLeads.length,
      disbursedLeads: myLeads.filter((l) => l.status === 'DISBURSED').length,
    })
  }),

  http.get(api('/commissions'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error

    return withQueryErrors(() => {
      const query = readQuery(request)
      const status = query.enum('status', COMMISSION_STATUSES)
      const month = query.month('month')
      const affiliateId =
        auth.user.role === 'AFFILIATE' ? auth.user.id : query.string('affiliateId')
      const page = query.page()

      const items = db.commissions
        .filter(
          (c) =>
            (!status || c.status === status) &&
            (!affiliateId || c.affiliateId === affiliateId) &&
            (!month || vnMonth(c.createdAt) === month),
        )
        .sort(newestFirst)
      const result = paginate(items, page)
      return HttpResponse.json({ ...result, data: result.data.map(toCommission) })
    })
  }),

  http.get(api('/payouts'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error

    return withQueryErrors(() => {
      const query = readQuery(request)
      const status = query.enum('status', PAYOUT_STATUSES)
      const month = query.month('month')
      const affiliateId =
        auth.user.role === 'AFFILIATE' ? auth.user.id : query.string('affiliateId')
      const page = query.page()

      const items = db.payouts
        .filter(
          (p) =>
            (!status || p.status === status) &&
            (!affiliateId || p.affiliateId === affiliateId) &&
            (!month || p.periodMonth === month),
        )
        .sort(newestFirst)
      const result = paginate(items, page)
      return HttpResponse.json({ ...result, data: result.data.map(toPayout) })
    })
  }),
]
