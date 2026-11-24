import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { formatMonth, formatVnd } from '@/lib/format'
import { db, findUserByEmail } from '@/mocks/db'
import { renderApp } from '@/test/render'
import { asText } from '@/test/text'

describe('CommissionsPage', () => {
  it('lists my commissions and filters them by status', async () => {
    const me = findUserByEmail('ctv1@demo.vn')!
    const mine = db.commissions.filter((c) => c.affiliateId === me.id)
    const { user, router } = renderApp('/commissions', { as: 'ctv1@demo.vn' })

    const table = within(await screen.findByRole('table'))
    expect(table.getAllByRole('row').slice(1)).toHaveLength(Math.min(20, mine.length))

    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'PAID')

    const paid = mine.filter((c) => c.status === 'PAID')
    expect(await screen.findByText(new RegExp(`trên ${paid.length} khoản hoa hồng$`))).toBeVisible()
    expect(router.state.location.search).toBe('?status=PAID')
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    // Each row shows its status (twice in the DOM: the column, and a copy under the amount
    // that only phones display).
    for (const row of rows)
      expect(within(row).getAllByText('Đã thanh toán').length).toBeGreaterThan(0)
  })

  it('shows admins every affiliate with an affiliate column and no personal summary', async () => {
    renderApp('/commissions', { as: 'admin@demo.vn' })

    const table = within(await screen.findByRole('table'))
    expect(table.getByRole('columnheader', { name: 'Cộng tác viên' })).toBeVisible()
    // The personal summary (GET /commissions/summary) is affiliate-only.
    expect(screen.queryByText('Tỉ lệ giải ngân')).toBeNull()
  })
})

describe('PayoutsPage', () => {
  it('shows the paid payout to its affiliate', async () => {
    const payout = db.payouts[0]!
    renderApp('/payouts', { as: 'ctv1@demo.vn' })

    const table = within(await screen.findByRole('table'))
    expect(table.getByText(formatMonth(payout.periodMonth))).toBeVisible()
    expect(table.getByText(asText(formatVnd(payout.totalAmount)))).toBeVisible()
    expect(table.getByText('Đã thanh toán')).toBeVisible()
    expect(screen.getByText('Vietcombank · ******6789')).toBeVisible()
  })

  it('explains when an affiliate has no payout yet', async () => {
    renderApp('/payouts', { as: 'ctv3@demo.vn' })

    expect(await screen.findByText('Chưa có kỳ chi trả')).toBeVisible()
    expect(screen.getByText(/chưa có thông tin tài khoản ngân hàng/)).toBeVisible()
  })
})
