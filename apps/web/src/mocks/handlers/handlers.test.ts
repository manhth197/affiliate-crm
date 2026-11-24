import { describe, expect, it } from 'vitest'
import { apiRequest } from '@/api/client'
import type { ApiError } from '@/api/errors'
import type {
  Commission,
  CommissionSummary,
  Lead,
  LeadActivity,
  Paginated,
  Product,
  StaffMember,
} from '@/api/types'
import { vnDayRange, vnDay } from '@/lib/dates'
import { type DemoEmail, signInAs } from '@/test/render'
import { db, findUserByEmail } from '../db'

const fail = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected the request to fail')
    },
    (error: unknown) => error as ApiError,
  )

describe('mock API: leads', () => {
  it('shows an affiliate only their own leads, with phone and national ID masked', async () => {
    const me = signInAs('ctv1@demo.vn')
    const page = await apiRequest<Paginated<Lead>>('/leads', { query: { pageSize: 100 } })

    const mine = db.leads.filter((l) => l.affiliateId === me.id)
    expect(page.meta.total).toBe(mine.length)
    for (const lead of page.data) {
      expect(lead.affiliate.id).toBe(me.id)
      expect(lead.customerPhone).toMatch(/^\d{2}\*{6}\d{2}$/)
      if (lead.customerNationalId) expect(lead.customerNationalId).toMatch(/^\*{9}\d{3}$/)
    }
  })

  it('ignores affiliateId for affiliates', async () => {
    const me = signInAs('ctv1@demo.vn')
    const other = db.users.find((u) => u.email === 'ctv2@demo.vn')!
    const page = await apiRequest<Paginated<Lead>>('/leads', { query: { affiliateId: other.id } })
    expect(page.data.every((lead) => lead.affiliate.id === me.id)).toBe(true)
  })

  it('shows staff every lead unmasked, newest first', async () => {
    signInAs('staff@demo.vn')
    const page = await apiRequest<Paginated<Lead>>('/leads')

    expect(page.meta).toEqual({ page: 1, pageSize: 20, total: 120 })
    expect(page.data[0]!.customerPhone).toMatch(/^0\d{9}$/)
    const times = page.data.map((l) => Date.parse(l.createdAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('filters by status and searches names without diacritics', async () => {
    signInAs('staff@demo.vn')
    const rejected = await apiRequest<Paginated<Lead>>('/leads', {
      query: { status: 'REJECTED', pageSize: 100 },
    })
    expect(rejected.data.length).toBeGreaterThan(0)
    expect(rejected.data.every((l) => l.status === 'REJECTED')).toBe(true)

    const target = db.leads[0]!
    const plain = target.customerName
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
    const found = await apiRequest<Paginated<Lead>>('/leads', { query: { q: plain } })
    expect(found.data.map((l) => l.id)).toContain(target.id)
  })

  it('treats from/to as a half-open range on createdAt', async () => {
    signInAs('staff@demo.vn')
    const day = vnDay(db.leads[60]!.createdAt)
    const page = await apiRequest<Paginated<Lead>>('/leads', {
      query: { ...vnDayRange(day, day), pageSize: 100 },
    })

    expect(page.meta.total).toBe(db.leads.filter((l) => vnDay(l.createdAt) === day).length)
    expect(page.data.every((l) => vnDay(l.createdAt) === day)).toBe(true)
  })

  it('filters unassigned leads with assignedStaffId=none', async () => {
    signInAs('staff@demo.vn')
    const page = await apiRequest<Paginated<Lead>>('/leads', {
      query: { assignedStaffId: 'none', pageSize: 100 },
    })
    expect(page.meta.total).toBe(db.leads.filter((l) => l.assignedStaffId === null).length)
    expect(page.data.every((l) => l.assignedStaff === null)).toBe(true)
  })

  it('sorts by amount with empty amounts last', async () => {
    signInAs('staff@demo.vn')
    const page = await apiRequest<Paginated<Lead>>('/leads', {
      query: { sort: 'requestedAmount:desc', pageSize: 100 },
    })
    const amounts = page.data.map((l) => l.requestedAmount)
    const firstNull = amounts.indexOf(null)
    const known = amounts.slice(0, firstNull) as number[]
    expect(known).toEqual([...known].sort((a, b) => b - a))
    expect(amounts.slice(firstNull).every((a) => a === null)).toBe(true)
  })

  it('answers 400 with details for an invalid filter', async () => {
    signInAs('staff@demo.vn')
    const error = await fail(apiRequest('/leads', { query: { status: 'DONE' } }))
    expect(error.status).toBe(400)
    expect(error.details[0]?.field).toBe('status')

    const badSort = await fail(apiRequest('/leads', { query: { sort: 'customerName:asc' } }))
    expect(badSort.status).toBe(400)
  })

  it("forbids an affiliate from reading another affiliate's lead", async () => {
    signInAs('ctv1@demo.vn')
    const ctv2 = db.users.find((u) => u.email === 'ctv2@demo.vn')!
    const foreign = db.leads.find((l) => l.affiliateId === ctv2.id)!

    expect((await fail(apiRequest(`/leads/${foreign.id}`))).status).toBe(403)
    expect((await fail(apiRequest('/leads/khong-ton-tai'))).status).toBe(404)
  })

  it('hides internal notes from affiliates but not from staff', async () => {
    const withNote = db.activities.find((a) => a.type === 'NOTE')!
    const lead = db.leads.find((l) => l.id === withNote.leadId)!
    const owner = db.users.find((u) => u.id === lead.affiliateId)!

    signInAs(owner.email as DemoEmail)
    const forOwner = await apiRequest<LeadActivity[]>(`/leads/${lead.id}/activities`)
    expect(forOwner.some((a) => a.type === 'NOTE')).toBe(false)

    signInAs('staff@demo.vn')
    const forStaff = await apiRequest<LeadActivity[]>(`/leads/${lead.id}/activities`)
    expect(forStaff.some((a) => a.type === 'NOTE')).toBe(true)
    const assigned = forStaff.find((a) => a.type === 'ASSIGNED')
    expect(assigned?.assignee?.fullName).toBeTruthy()
    const times = forStaff.map((a) => Date.parse(a.createdAt))
    expect(times).toEqual([...times].sort((a, b) => b - a)) // newest first
  })
})

describe('mock API: create lead', () => {
  const loan = () => db.products.find((p) => p.category === 'LOAN' && p.active)!

  it('creates a NEW lead for the affiliate and returns it masked', async () => {
    const me = signInAs('ctv1@demo.vn')
    const lead = await apiRequest<Lead>('/leads', {
      method: 'POST',
      body: {
        productId: loan().id,
        customerName: 'Trịnh Văn Tài',
        customerPhone: '+84 912 000 111',
        requestedAmount: 50_000_000,
      },
    })

    expect(lead).toMatchObject({
      status: 'NEW',
      code: 'LD-000121',
      customerPhone: '09******11',
      affiliate: { id: me.id },
    })
    expect(db.leads.at(-1)?.customerPhone).toBe('0912000111')
  })

  it('rejects unknown properties (strict bodies)', async () => {
    signInAs('ctv1@demo.vn')
    const error = await fail(
      apiRequest('/leads', {
        method: 'POST',
        body: {
          productId: loan().id,
          customerName: 'A',
          customerPhone: '0912000111',
          status: 'APPROVED',
        },
      }),
    )
    expect(error.status).toBe(400)
    expect(error.details).toEqual([
      { field: 'status', message: 'property status should not exist' },
    ])
  })

  it('only lets affiliates create leads', async () => {
    signInAs('staff@demo.vn')
    const error = await fail(apiRequest('/leads', { method: 'POST', body: {} }))
    expect(error.status).toBe(403)
  })

  it('blocks a second open lead for the same product and phone (409 DUPLICATE_LEAD)', async () => {
    signInAs('ctv2@demo.vn') // even a different affiliate
    const open = db.leads.find((l) => l.status === 'NEW')!
    const error = await fail(
      apiRequest('/leads', {
        method: 'POST',
        body: {
          productId: open.productId,
          customerName: 'Khách trùng',
          customerPhone: open.customerPhone,
        },
      }),
    )
    expect(error).toMatchObject({ status: 409, code: 'DUPLICATE_LEAD' })
    // The message must not reveal who owns the other lead.
    expect(error.message).not.toContain(open.affiliateId)
  })

  it('allows a new lead once the old one is closed', async () => {
    signInAs('ctv1@demo.vn')
    const closed = db.leads.find((l) => l.status === 'REJECTED')!
    const product = db.products.find((p) => p.id === closed.productId)!
    const lead = await apiRequest<Lead>('/leads', {
      method: 'POST',
      body: {
        productId: closed.productId,
        customerName: 'Khách cũ',
        customerPhone: closed.customerPhone,
        ...(product.category === 'LOAN' && { requestedAmount: 20_000_000 }),
      },
    })
    expect(lead.status).toBe('NEW')
  })

  it('rejects an amount on a non-loan product (422 AMOUNT_NOT_ALLOWED)', async () => {
    signInAs('ctv1@demo.vn')
    const card = db.products.find((p) => p.category === 'CREDIT_CARD' && p.active)!
    const error = await fail(
      apiRequest('/leads', {
        method: 'POST',
        body: {
          productId: card.id,
          customerName: 'A',
          customerPhone: '0912000111',
          requestedAmount: 5_000_000,
        },
      }),
    )
    expect(error).toMatchObject({ status: 422, code: 'AMOUNT_NOT_ALLOWED' })
  })

  it('accepts a 9-digit CMND as well as a 12-digit CCCD', async () => {
    signInAs('ctv1@demo.vn')
    const card = db.products.find((p) => p.category === 'CREDIT_CARD' && p.active)!
    const lead = await apiRequest<Lead>('/leads', {
      method: 'POST',
      body: {
        productId: card.id,
        customerName: 'A',
        customerPhone: '0912000222',
        customerNationalId: '123456789',
      },
    })
    expect(lead.customerNationalId).toBe('******789')
  })

  it('refuses an inactive product with 422', async () => {
    signInAs('ctv1@demo.vn')
    const inactive = db.products.find((p) => !p.active)!
    const error = await fail(
      apiRequest('/leads', {
        method: 'POST',
        body: { productId: inactive.id, customerName: 'A', customerPhone: '0912000111' },
      }),
    )
    expect(error).toMatchObject({ status: 422, code: 'PRODUCT_UNAVAILABLE' })
  })
})

describe('mock API: commissions, payouts, products, staff', () => {
  it('summarizes an affiliate’s commissions consistently with the list', async () => {
    signInAs('ctv1@demo.vn')
    const summary = await apiRequest<CommissionSummary>('/commissions/summary')
    const list = await apiRequest<Paginated<Commission>>('/commissions', {
      query: { pageSize: 100 },
    })

    const total = (status: Commission['status']) =>
      list.data.filter((c) => c.status === status).reduce((sum, c) => sum + c.amount, 0)
    expect(summary.pending).toBe(total('PENDING'))
    expect(summary.approved).toBe(total('APPROVED'))
    expect(summary.paid).toBe(total('PAID'))
    expect(summary.paid).toBeGreaterThan(0)
  })

  it('shows affiliates only active products', async () => {
    signInAs('ctv1@demo.vn')
    const products = await apiRequest<Product[]>('/products', { query: { active: false } })
    expect(products.length).toBeGreaterThan(0)
    expect(products.every((p) => p.active)).toBe(true)
  })

  it('lists assignable staff for staff and admins only', async () => {
    signInAs('staff@demo.vn')
    const staff = await apiRequest<StaffMember[]>('/staff')
    expect(staff.map((s) => s.role).sort()).toEqual(['ADMIN', 'STAFF'])

    signInAs('ctv1@demo.vn')
    expect((await fail(apiRequest('/staff'))).status).toBe(403)
  })
})

describe('mock API: pipeline actions (M3)', () => {
  const lead = (status: Lead['status']) => db.leads.find((l) => l.status === status)!
  const patchStatus = (id: string, body: object) =>
    apiRequest<Lead>(`/leads/${id}/status`, { method: 'PATCH', body })

  it('rejects a skipped step with 409 INVALID_TRANSITION listing the next steps', async () => {
    signInAs('staff@demo.vn')
    const error = await fail(patchStatus(lead('NEW').id, { status: 'APPROVED' }))
    expect(error).toMatchObject({ status: 409, code: 'INVALID_TRANSITION' })
    expect(error.message).toContain('CONTACTED, REJECTED')
  })

  it('requires disbursedAmount for DISBURSED and refuses it otherwise', async () => {
    signInAs('staff@demo.vn')
    const approved = lead('APPROVED')
    expect((await fail(patchStatus(approved.id, { status: 'DISBURSED' }))).status).toBe(400)
    const extra = await fail(
      patchStatus(lead('NEW').id, { status: 'CONTACTED', disbursedAmount: 1 }),
    )
    expect(extra.details[0]?.field).toBe('disbursedAmount')

    const done = await patchStatus(approved.id, {
      status: 'DISBURSED',
      disbursedAmount: 40_000_000,
    })
    expect(done).toMatchObject({ status: 'DISBURSED', disbursedAmount: 40_000_000 })
  })

  it('lets only staff and admins act on leads', async () => {
    signInAs('ctv1@demo.vn')
    const mine = db.leads.find(
      (l) => l.affiliateId === findUserByEmail('ctv1@demo.vn')!.id && l.status === 'NEW',
    )!
    expect((await fail(patchStatus(mine.id, { status: 'CONTACTED' }))).status).toBe(403)
    expect(
      (await fail(apiRequest(`/leads/${mine.id}/notes`, { method: 'POST', body: { note: 'x' } })))
        .status,
    ).toBe(403)
  })

  it('assigns only to active staff/admins, and re-assigning is a no-op', async () => {
    signInAs('admin@demo.vn')
    const target = lead('NEW')
    const staff = findUserByEmail('staff@demo.vn')!
    const affiliate = findUserByEmail('ctv1@demo.vn')!
    const assign = (staffId: string) =>
      apiRequest<Lead>(`/leads/${target.id}/assign`, { method: 'PATCH', body: { staffId } })

    expect(await fail(assign(affiliate.id))).toMatchObject({
      status: 422,
      code: 'ASSIGNEE_NOT_STAFF',
    })
    await assign(staff.id)
    const count = () => db.activities.filter((a) => a.leadId === target.id).length
    const before = count()
    expect((await assign(staff.id)).assignedStaff?.id).toBe(staff.id)
    expect(count()).toBe(before)
  })

  it('validates products and keeps commission values in range', async () => {
    signInAs('admin@demo.vn')
    const error = await fail(
      apiRequest('/products', {
        method: 'POST',
        body: {
          name: 'X',
          partnerName: 'Y',
          category: 'LOAN',
          commissionType: 'PERCENT',
          commissionValue: 20_000,
        },
      }),
    )
    expect(error.details[0]?.field).toBe('commissionValue')

    signInAs('staff@demo.vn')
    expect((await fail(apiRequest('/products', { method: 'POST', body: {} }))).status).toBe(403)
  })

  it('does not let an admin disable themselves', async () => {
    const admin = signInAs('admin@demo.vn')
    const error = await fail(
      apiRequest(`/users/${admin.id}`, { method: 'PATCH', body: { status: 'DISABLED' } }),
    )
    expect(error).toMatchObject({ status: 422, code: 'CANNOT_DISABLE_SELF' })
  })
})
