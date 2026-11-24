import { http, HttpResponse } from 'msw'
import {
  type AddLeadNoteRequest,
  type AssignLeadRequest,
  type ChangeLeadStatusRequest,
  LEAD_STATUSES,
  LEAD_TRANSITIONS,
} from '@/api/types'
import { commissionFor } from '../commission'
import { db, findUserById } from '../db'
import { api, apiError, authenticate, businessError, latency, readJson } from '../http'
import { rejectUnknownProperties } from '../query'
import type { ActivityRecord, LeadRecord } from '../records'
import { toActivity, toLead } from '../serialize'

const BACK_OFFICE = ['STAFF', 'ADMIN'] as const

function findLead(id: string): LeadRecord | Response {
  return db.leads.find((l) => l.id === id) ?? apiError(404, 'Lead not found')
}

function addActivity(activity: Omit<ActivityRecord, 'id' | 'createdAt'>) {
  const record: ActivityRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...activity,
  }
  db.activities.push(record)
  return record
}

export const leadActionHandlers = [
  http.patch(api('/leads/:id/status'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request, BACK_OFFICE)
    if (auth.error) return auth.error
    const lead = findLead(String(params.id))
    if (lead instanceof Response) return lead

    const body = await readJson<ChangeLeadStatusRequest>(request)
    const unknown = rejectUnknownProperties(body, ['status', 'note', 'disbursedAmount'])
    if (unknown) return unknown
    const details: { field: string; message: string }[] = []
    if (!body.status || !LEAD_STATUSES.includes(body.status)) {
      details.push({ field: 'status', message: 'status must be a valid LeadStatus' })
    }
    const amount = body.disbursedAmount
    if (
      body.status === 'DISBURSED' &&
      (amount === undefined || !Number.isInteger(amount) || amount < 0)
    ) {
      details.push({
        field: 'disbursedAmount',
        message: 'disbursedAmount is required for DISBURSED',
      })
    }
    if (body.status !== 'DISBURSED' && amount !== undefined) {
      details.push({
        field: 'disbursedAmount',
        message: 'disbursedAmount is only allowed for DISBURSED',
      })
    }
    if (body.note !== undefined && body.note.length > 1000) {
      details.push({
        field: 'note',
        message: 'note must be shorter than or equal to 1000 characters',
      })
    }
    if (details.length > 0) return apiError(400, 'Validation failed', details)

    const from = lead.status
    const to = body.status!
    const allowed = LEAD_TRANSITIONS[from]
    if (!allowed.includes(to)) {
      const next = allowed.length ? allowed.join(', ') : 'none (final status)'
      return businessError(
        409,
        'INVALID_TRANSITION',
        `Cannot move from ${from} to ${to}. Allowed next: ${next}`,
      )
    }

    const now = new Date().toISOString()
    lead.status = to
    lead.updatedAt = now
    if (to === 'DISBURSED') lead.disbursedAmount = amount!
    addActivity({
      leadId: lead.id,
      type: 'STATUS_CHANGED',
      fromStatus: from,
      toStatus: to,
      note: body.note?.trim() || null,
      actorId: auth.user.id,
      assigneeId: null,
    })

    // Stand-in for the BullMQ job: a PENDING commission right away.
    if (to === 'DISBURSED' && !db.commissions.some((c) => c.leadId === lead.id)) {
      const product = db.products.find((p) => p.id === lead.productId)!
      db.commissions.push({
        id: crypto.randomUUID(),
        leadId: lead.id,
        affiliateId: lead.affiliateId,
        amount: commissionFor(product, amount!),
        status: 'PENDING',
        payoutId: null,
        createdAt: now,
      })
    }
    return HttpResponse.json(toLead(lead, auth.user))
  }),

  http.patch(api('/leads/:id/assign'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request, BACK_OFFICE)
    if (auth.error) return auth.error
    const lead = findLead(String(params.id))
    if (lead instanceof Response) return lead

    const body = await readJson<AssignLeadRequest>(request)
    const unknown = rejectUnknownProperties(body, ['staffId'])
    if (unknown) return unknown
    if (typeof body.staffId !== 'string' || !body.staffId) {
      return apiError(400, 'Validation failed', [
        { field: 'staffId', message: 'staffId must be a UUID' },
      ])
    }
    const assignee = findUserById(body.staffId)
    if (!assignee || assignee.status !== 'ACTIVE' || assignee.role === 'AFFILIATE') {
      return businessError(422, 'ASSIGNEE_NOT_STAFF', 'Assignee must be an active STAFF or ADMIN')
    }
    // Re-assigning to the same person is a no-op (no activity), per contract v0.3.
    if (lead.assignedStaffId !== assignee.id) {
      lead.assignedStaffId = assignee.id
      lead.updatedAt = new Date().toISOString()
      addActivity({
        leadId: lead.id,
        type: 'ASSIGNED',
        fromStatus: null,
        toStatus: null,
        note: null,
        actorId: auth.user.id,
        assigneeId: assignee.id,
      })
    }
    return HttpResponse.json(toLead(lead, auth.user))
  }),

  http.post(api('/leads/:id/notes'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request, BACK_OFFICE)
    if (auth.error) return auth.error
    const lead = findLead(String(params.id))
    if (lead instanceof Response) return lead

    const body = await readJson<AddLeadNoteRequest>(request)
    const unknown = rejectUnknownProperties(body, ['note'])
    if (unknown) return unknown
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    if (!note || note.length > 2000) {
      return apiError(400, 'Validation failed', [
        { field: 'note', message: 'note must be 1–2000 characters' },
      ])
    }
    const activity = addActivity({
      leadId: lead.id,
      type: 'NOTE',
      fromStatus: null,
      toStatus: null,
      note,
      actorId: auth.user.id,
      assigneeId: null,
    })
    return HttpResponse.json(toActivity(activity), { status: 201 })
  }),
]
