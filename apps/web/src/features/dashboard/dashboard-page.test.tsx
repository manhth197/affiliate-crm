import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CommissionStatus } from '@/api/types'
import { formatVnd } from '@/lib/format'
import { db, findUserByEmail } from '@/mocks/db'
import { renderApp } from '@/test/render'
import { asText } from '@/test/text'

describe('DashboardPage', () => {
  it('shows an affiliate their commission totals and recent leads', async () => {
    const me = findUserByEmail('ctv1@demo.vn')!
    const total = (status: CommissionStatus) =>
      db.commissions
        .filter((c) => c.affiliateId === me.id && c.status === status)
        .reduce((sum, c) => sum + c.amount, 0)
    renderApp('/', { as: 'ctv1@demo.vn' })

    expect(await screen.findByText(asText(formatVnd(total('PENDING'))))).toBeVisible()
    expect(screen.getByText(asText(formatVnd(total('APPROVED'))))).toBeVisible()
    expect(screen.getByText(asText(formatVnd(total('PAID'))))).toBeVisible()

    const recent = within(await screen.findByRole('list', { name: 'Lead gần đây' }))
    expect(recent.getAllByRole('link')).toHaveLength(5)
    expect(screen.getByText('CTV001')).toBeVisible()
  })

  it('shows staff how many leads wait in each open stage', async () => {
    renderApp('/', { as: 'staff@demo.vn' })

    const newCount = db.leads.filter((l) => l.status === 'NEW').length
    const card = await screen.findByRole('link', { name: /^Mới/ })
    expect(await within(card).findByText(String(newCount))).toBeVisible()
    expect(card).toHaveAttribute('href', '/leads?status=NEW')
  })
})
