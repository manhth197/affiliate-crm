import { describe, expect, it } from 'vitest'
import { LEAD_STATUSES } from '@/api/types'
import { commissionFor } from './commission'
import { createSeed } from './seed'

const NOW = Date.parse('2026-11-24T03:00:00.000Z')
const seed = createSeed(NOW)
const DAY = 24 * 60 * 60 * 1000

describe('mock seed (contract "Seed data")', () => {
  it('has the demo accounts and 6 products in 3 categories with both commission types', () => {
    expect(seed.users.map((u) => u.email)).toEqual([
      'admin@demo.vn',
      'staff@demo.vn',
      'ctv1@demo.vn',
      'ctv2@demo.vn',
      'ctv3@demo.vn',
    ])
    expect(seed.products).toHaveLength(6)
    expect(new Set(seed.products.map((p) => p.category)).size).toBe(3)
    expect(new Set(seed.products.map((p) => p.commissionType)).size).toBe(2)
  })

  it('has about 120 leads over the last 60 days, in every status', () => {
    expect(seed.leads).toHaveLength(120)
    for (const lead of seed.leads) {
      const created = Date.parse(lead.createdAt)
      expect(created).toBeLessThan(NOW)
      expect(created).toBeGreaterThan(NOW - 61 * DAY)
    }
    const statuses = new Set(seed.leads.map((lead) => lead.status))
    expect([...statuses].sort()).toEqual([...LEAD_STATUSES].sort())
  })

  it('gives each lead a timeline that ends in its current status', () => {
    for (const lead of seed.leads) {
      const timeline = seed.activities.filter((a) => a.leadId === lead.id)
      expect(timeline[0]?.type).toBe('CREATED')
      const times = timeline.map((a) => Date.parse(a.createdAt))
      expect(times).toEqual([...times].sort((a, b) => a - b))
      const lastChange = timeline.filter((a) => a.toStatus).at(-1)
      expect(lastChange?.toStatus).toBe(lead.status)
    }
  })

  it('creates one commission per disbursed lead using the product rule', () => {
    const disbursed = seed.leads.filter((lead) => lead.status === 'DISBURSED')
    expect(seed.commissions).toHaveLength(disbursed.length)
    for (const commission of seed.commissions) {
      const lead = seed.leads.find((l) => l.id === commission.leadId)!
      const product = seed.products.find((p) => p.id === lead.productId)!
      expect(commission.amount).toBe(commissionFor(product, lead.disbursedAmount!))
    }
  })

  it('has exactly one paid payout whose totals match its commissions', () => {
    expect(seed.payouts).toHaveLength(1)
    const [payout] = seed.payouts
    const items = seed.commissions.filter((c) => c.payoutId === payout!.id)
    expect(payout).toMatchObject({
      status: 'PAID',
      commissionCount: items.length,
      totalAmount: items.reduce((sum, c) => sum + c.amount, 0),
    })
    expect(items.every((c) => c.status === 'PAID')).toBe(true)
  })

  it('is deterministic', () => {
    expect(createSeed(NOW)).toEqual(seed)
  })
})
