import { addDays, format, parseISO } from 'date-fns'
import { http, HttpResponse } from 'msw'
import {
  type CommissionStatus,
  LEAD_STATUSES,
  type LeadStatus,
  type ReportsOverview,
  type TopAffiliate,
} from '@/api/types'
import { vnDay } from '@/lib/dates'
import { db } from '../db'
import { api, apiError, authenticate, latency } from '../http'
import { readQuery, withQueryErrors } from '../query'

const DAY = 24 * 60 * 60 * 1000
const COMMISSION_STATUSES: CommissionStatus[] = ['PENDING', 'APPROVED', 'PAID', 'CANCELLED']

/** [from, to) in epoch ms; defaults to the last 30 days. */
function readRange(request: Request) {
  const query = readQuery(request)
  const to = query.datetime('to') ?? Date.now()
  const from = query.datetime('from') ?? to - 30 * DAY
  return { query, from, to }
}

const inRange = (iso: string, from: number, to: number) => {
  const time = Date.parse(iso)
  return time >= from && time < to
}

/** Every Vietnam calendar day touched by [from, to), so the chart has no gaps. */
function daysBetween(from: number, to: number): string[] {
  const days: string[] = []
  const last = vnDay(new Date(to - 1))
  for (let day = vnDay(new Date(from)); day <= last;) {
    days.push(day)
    day = format(addDays(parseISO(day), 1), 'yyyy-MM-dd')
  }
  return days
}

export const reportHandlers = [
  http.get(api('/reports/overview'), async ({ request }) => {
    await latency()
    const auth = authenticate(request, ['STAFF', 'ADMIN'])
    if (auth.error) return auth.error
    return withQueryErrors(() => {
      const { from, to } = readRange(request)
      if (from >= to)
        return apiError(400, 'Validation failed', [
          { field: 'from', message: 'from must be before to' },
        ])

      const leads = db.leads.filter((l) => inRange(l.createdAt, from, to))
      const leadsByStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<
        LeadStatus,
        number
      >
      leads.forEach((l) => leadsByStatus[l.status]++)
      const disbursed = leads.filter((l) => l.status === 'DISBURSED')

      const commissionByStatus = Object.fromEntries(
        COMMISSION_STATUSES.map((s) => [s, 0]),
      ) as Record<CommissionStatus, number>
      db.commissions
        .filter((c) => inRange(c.createdAt, from, to))
        .forEach((c) => (commissionByStatus[c.status] += c.amount))

      const perDay = new Map(daysBetween(from, to).map((day) => [day, 0]))
      leads.forEach((l) => {
        const day = vnDay(l.createdAt)
        perDay.set(day, (perDay.get(day) ?? 0) + 1)
      })

      return HttpResponse.json<ReportsOverview>({
        leadsByStatus,
        conversionRate: leads.length ? disbursed.length / leads.length : 0,
        disbursedAmount: disbursed.reduce((sum, l) => sum + (l.disbursedAmount ?? 0), 0),
        commissionByStatus,
        leadsPerDay: [...perDay].map(([date, count]) => ({ date, count })),
      })
    })
  }),

  http.get(api('/reports/top-affiliates'), async ({ request }) => {
    await latency()
    const auth = authenticate(request, ['STAFF', 'ADMIN'])
    if (auth.error) return auth.error
    return withQueryErrors(() => {
      const { query, from, to } = readRange(request)
      const limit = Number(query.string('limit') ?? 10)
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        return apiError(400, 'Validation failed', [
          { field: 'limit', message: 'limit must be 1–50' },
        ])
      }
      const rows: TopAffiliate[] = db.affiliates.map((profile) => {
        const user = db.users.find((u) => u.id === profile.userId)!
        const leads = db.leads.filter(
          (l) => l.affiliateId === user.id && inRange(l.createdAt, from, to),
        )
        return {
          affiliate: { id: user.id, fullName: user.fullName, referralCode: profile.referralCode },
          leads: leads.length,
          disbursed: leads.filter((l) => l.status === 'DISBURSED').length,
          commission: db.commissions
            .filter(
              (c) =>
                c.affiliateId === user.id &&
                c.status !== 'CANCELLED' &&
                inRange(c.createdAt, from, to),
            )
            .reduce((sum, c) => sum + c.amount, 0),
        }
      })
      rows.sort(
        (a, b) => b.commission - a.commission || b.disbursed - a.disbursed || b.leads - a.leads,
      )
      return HttpResponse.json(rows.filter((r) => r.leads > 0 || r.commission > 0).slice(0, limit))
    })
  }),
]
