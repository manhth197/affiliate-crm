import { http, HttpResponse } from 'msw'
import { type CreateLeadRequest, LEAD_STATUSES, type User } from '@/api/types'
import { toLocalPhone, VN_PHONE_REGEX } from '@/lib/validation'
import { db } from '../db'
import { api, apiError, authenticate, latency, readJson } from '../http'
import { foldText, paginate, readQuery, rejectUnknownProperties, withQueryErrors } from '../query'
import type { LeadRecord } from '../records'
import { toActivity, toLead } from '../serialize'

const SORTABLE = ['createdAt', 'updatedAt'] as const

/** Owner, STAFF and ADMIN may read a lead; another affiliate gets 403. */
function findReadableLead(id: string, viewer: User): LeadRecord | Response {
  const lead = db.leads.find((l) => l.id === id)
  if (!lead) return apiError(404, 'Lead not found')
  if (viewer.role === 'AFFILIATE' && lead.affiliateId !== viewer.id) {
    return apiError(403, 'You can only access your own leads')
  }
  return lead
}

export const leadHandlers = [
  http.get(api('/leads'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    const viewer = auth.user

    return withQueryErrors(() => {
      const query = readQuery(request)
      const status = query.enum('status', LEAD_STATUSES)
      const productId = query.string('productId')
      const affiliateId = viewer.role === 'AFFILIATE' ? viewer.id : query.string('affiliateId')
      const assignedStaffId = query.string('assignedStaffId')
      const search = query.string('q')
      const from = query.datetime('from')
      const to = query.datetime('to')
      const page = query.page()
      const [sortField = 'createdAt', sortDir = 'desc'] = (
        query.string('sort') ?? 'createdAt:desc'
      ).split(':')
      if (!SORTABLE.includes(sortField as never) || !['asc', 'desc'].includes(sortDir)) {
        return apiError(400, 'Validation failed', [{ field: 'sort', message: 'invalid sort' }])
      }

      const needle = search ? foldText(search.trim()) : undefined
      const digits = search?.replace(/\D/g, '')
      const leads = db.leads
        .filter((lead) => {
          if (status && lead.status !== status) return false
          if (productId && lead.productId !== productId) return false
          if (affiliateId && lead.affiliateId !== affiliateId) return false
          if (assignedStaffId && lead.assignedStaffId !== assignedStaffId) return false
          const created = Date.parse(lead.createdAt)
          if (from !== undefined && created < from) return false
          if (to !== undefined && created >= to) return false // half-open [from, to)
          if (needle) {
            const inText =
              foldText(lead.code).includes(needle) || foldText(lead.customerName).includes(needle)
            const inPhone = !!digits && digits.length >= 3 && lead.customerPhone.includes(digits)
            if (!inText && !inPhone) return false
          }
          return true
        })
        .sort((a, b) => {
          const field = sortField as (typeof SORTABLE)[number]
          const diff = Date.parse(a[field]) - Date.parse(b[field])
          return sortDir === 'asc' ? diff : -diff
        })

      const result = paginate(leads, page)
      return HttpResponse.json({ ...result, data: result.data.map((l) => toLead(l, viewer)) })
    })
  }),

  http.post(api('/leads'), async ({ request }) => {
    await latency()
    const auth = authenticate(request, ['AFFILIATE'])
    if (auth.error) return auth.error
    const body = await readJson<CreateLeadRequest>(request)

    const unknown = rejectUnknownProperties(body, [
      'productId',
      'customerName',
      'customerPhone',
      'customerNationalId',
      'requestedAmount',
      'note',
    ])
    if (unknown) return unknown

    const details: { field: string; message: string }[] = []
    const product = db.products.find((p) => p.id === body.productId)
    if (!product) details.push({ field: 'productId', message: 'productId must be a valid product' })
    if (!body.customerName?.trim()) {
      details.push({ field: 'customerName', message: 'customerName should not be empty' })
    }
    const phone = typeof body.customerPhone === 'string' ? toLocalPhone(body.customerPhone) : ''
    if (!VN_PHONE_REGEX.test(phone)) {
      details.push({ field: 'customerPhone', message: 'must be a valid VN phone number' })
    }
    if (body.customerNationalId !== undefined && !/^\d{12}$/.test(body.customerNationalId)) {
      details.push({ field: 'customerNationalId', message: 'must be 12 digits' })
    }
    if (
      body.requestedAmount !== undefined &&
      (!Number.isInteger(body.requestedAmount) || body.requestedAmount <= 0)
    ) {
      details.push({ field: 'requestedAmount', message: 'must be a positive integer' })
    }
    if (details.length > 0) return apiError(400, 'Validation failed', details)
    if (!product!.active) return apiError(422, 'Product is not active')

    const now = new Date().toISOString()
    const lead: LeadRecord = {
      id: crypto.randomUUID(),
      code: `LD-${String(db.leads.length + 1).padStart(6, '0')}`,
      affiliateId: auth.user.id,
      productId: product!.id,
      customerName: body.customerName!.trim(),
      customerPhone: phone,
      customerNationalId: body.customerNationalId ?? null,
      requestedAmount: body.requestedAmount ?? null,
      disbursedAmount: null,
      status: 'NEW',
      assignedStaffId: null,
      createdAt: now,
      updatedAt: now,
    }
    db.leads.push(lead)
    db.activities.push({
      id: crypto.randomUUID(),
      leadId: lead.id,
      type: 'CREATED',
      fromStatus: null,
      toStatus: 'NEW',
      note: body.note?.trim() || null,
      actorId: auth.user.id,
      createdAt: now,
    })
    return HttpResponse.json(toLead(lead, auth.user), { status: 201 })
  }),

  http.get(api('/leads/:id'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    const lead = findReadableLead(String(params.id), auth.user)
    if (lead instanceof Response) return lead
    return HttpResponse.json(toLead(lead, auth.user))
  }),

  http.get(api('/leads/:id/activities'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    const lead = findReadableLead(String(params.id), auth.user)
    if (lead instanceof Response) return lead

    const activities = db.activities
      .filter((a) => a.leadId === lead.id)
      // Affiliates do not see internal staff notes.
      .filter((a) => auth.user.role !== 'AFFILIATE' || a.type !== 'NOTE')
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return HttpResponse.json(activities.map(toActivity))
  }),
]
