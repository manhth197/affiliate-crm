import { http, HttpResponse } from 'msw'
import type {
  CancelCommissionRequest,
  CommissionStatus,
  CommissionSummary,
  PayoutStatus,
} from '@/api/types'
import { vnMonth } from '@/lib/dates'
import { db, persistDb } from '../db'
import { api, apiError, authenticate, businessError, latency, readJson } from '../http'
import { payoutPaidContent } from '../notification-content'
import { notify } from '../notify'
import { paginate, readQuery, rejectUnknownProperties, withQueryErrors } from '../query'
import { mockRealtime } from '../realtime'
import type { PayoutRecord } from '../records'
import { toCommission, toPayout } from '../serialize'

/** Time the fake BullMQ payout job takes in the browser (instant in tests). */
const JOB_DELAY_MS = import.meta.env.MODE === 'test' ? 0 : 1200

function payoutChanged(payout: PayoutRecord) {
  mockRealtime.emit([`user:${payout.affiliateId}`, 'role:ADMIN'], 'payout:updated', {
    payoutId: payout.id,
    status: payout.status,
  })
}

/** What POST /payouts/generate's job does: one DRAFT payout per affiliate for the month. */
function runGeneratePayoutsJob(month: string) {
  const byAffiliate = new Map<string, typeof db.commissions>()
  for (const c of db.commissions) {
    if (c.status !== 'APPROVED' || c.payoutId || vnMonth(c.createdAt) > month) continue
    byAffiliate.set(c.affiliateId, [...(byAffiliate.get(c.affiliateId) ?? []), c])
  }
  for (const [affiliateId, commissions] of byAffiliate) {
    // Idempotent: a second run for the same month does not create a second payout.
    if (db.payouts.some((p) => p.affiliateId === affiliateId && p.periodMonth === month)) continue
    const payout: PayoutRecord = {
      id: crypto.randomUUID(),
      affiliateId,
      periodMonth: month,
      totalAmount: commissions.reduce((sum, c) => sum + c.amount, 0),
      commissionCount: commissions.length,
      status: 'DRAFT',
      paidAt: null,
      createdAt: new Date().toISOString(),
    }
    db.payouts.push(payout)
    commissions.forEach((c) => (c.payoutId = payout.id))
    payoutChanged(payout)
  }
  persistDb()
}

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

  // ---- Admin actions ----
  http.patch(api('/commissions/:id/approve'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    const commission = db.commissions.find((c) => c.id === params.id)
    if (!commission) return apiError(404, 'Commission not found')
    if (commission.status !== 'PENDING') {
      return businessError(
        409,
        'INVALID_COMMISSION_STATUS',
        'Only PENDING commissions can be approved',
      )
    }
    commission.status = 'APPROVED'
    return HttpResponse.json(toCommission(commission))
  }),

  http.patch(api('/commissions/:id/cancel'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    const commission = db.commissions.find((c) => c.id === params.id)
    if (!commission) return apiError(404, 'Commission not found')
    const body = await readJson<CancelCommissionRequest>(request)
    const unknown = rejectUnknownProperties(body, ['reason'])
    if (unknown) return unknown
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!reason || reason.length > 500) {
      return apiError(400, 'Validation failed', [
        { field: 'reason', message: 'reason must be 1–500 characters' },
      ])
    }
    if (!['PENDING', 'APPROVED'].includes(commission.status) || commission.payoutId) {
      return businessError(
        409,
        'INVALID_COMMISSION_STATUS',
        'Only PENDING or APPROVED commissions outside a payout can be cancelled',
      )
    }
    commission.status = 'CANCELLED'
    return HttpResponse.json(toCommission(commission))
  }),

  http.post(api('/payouts/generate'), async ({ request }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    const body = await readJson<{ month: string }>(request)
    const unknown = rejectUnknownProperties(body, ['month'])
    if (unknown) return unknown
    if (typeof body.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)) {
      return apiError(400, 'Validation failed', [
        { field: 'month', message: 'month must match YYYY-MM' },
      ])
    }
    // Like BullMQ: answer 202 at once, do the work in the background.
    setTimeout(() => runGeneratePayoutsJob(body.month!), JOB_DELAY_MS)
    return HttpResponse.json({ jobId: `payouts-${body.month}` }, { status: 202 })
  }),

  http.patch(api('/payouts/:id/confirm'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    const payout = db.payouts.find((p) => p.id === params.id)
    if (!payout) return apiError(404, 'Payout not found')
    if (payout.status !== 'DRAFT') return apiError(409, 'Only DRAFT payouts can be confirmed')
    payout.status = 'CONFIRMED'
    payoutChanged(payout)
    return HttpResponse.json(toPayout(payout))
  }),

  http.patch(api('/payouts/:id/mark-paid'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    const payout = db.payouts.find((p) => p.id === params.id)
    if (!payout) return apiError(404, 'Payout not found')
    if (payout.status !== 'CONFIRMED')
      return apiError(409, 'Only CONFIRMED payouts can be marked paid')
    payout.status = 'PAID'
    payout.paidAt = new Date().toISOString()
    db.commissions.filter((c) => c.payoutId === payout.id).forEach((c) => (c.status = 'PAID'))
    notify(payout.affiliateId, payoutPaidContent(payout))
    payoutChanged(payout)
    return HttpResponse.json(toPayout(payout))
  }),
]
