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
import { db } from '../db'

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

  it('answers 400 with details for an invalid filter', async () => {
    signInAs('staff@demo.vn')
    const error = await fail(apiRequest('/leads', { query: { status: 'DONE' } }))
    expect(error.status).toBe(400)
    expect(error.details[0]?.field).toBe('status')
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

  it('refuses an inactive product with 422', async () => {
    signInAs('ctv1@demo.vn')
    const inactive = db.products.find((p) => !p.active)!
    const error = await fail(
      apiRequest('/leads', {
        method: 'POST',
        body: { productId: inactive.id, customerName: 'A', customerPhone: '0912000111' },
      }),
    )
    expect(error.status).toBe(422)
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
