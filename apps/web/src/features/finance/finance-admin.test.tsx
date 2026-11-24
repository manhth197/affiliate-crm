import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { previousMonth, vnMonth } from '@/lib/dates'
import { formatMonth } from '@/lib/format'
import { db, findUserByEmail } from '@/mocks/db'
import { renderApp } from '@/test/render'

describe('Commissions (admin)', () => {
  it('approves a pending commission', async () => {
    const pending = db.commissions.find((c) => c.status === 'PENDING')!
    const lead = db.leads.find((l) => l.id === pending.leadId)!
    const { user } = renderApp('/commissions?status=PENDING', { as: 'admin@demo.vn' })

    await user.click(await screen.findByRole('button', { name: `Duyệt hoa hồng ${lead.code}` }))

    expect(await screen.findByText(`Đã duyệt hoa hồng ${lead.code}`)).toBeVisible()
    expect(db.commissions.find((c) => c.id === pending.id)?.status).toBe('APPROVED')
  })

  it('cancels a commission only with a reason', async () => {
    const approved = db.commissions.find((c) => c.status === 'APPROVED' && !c.payoutId)!
    const lead = db.leads.find((l) => l.id === approved.leadId)!
    const { user } = renderApp('/commissions?status=APPROVED', { as: 'admin@demo.vn' })

    await user.click(await screen.findByRole('button', { name: `Hủy hoa hồng ${lead.code}` }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Hủy hoa hồng' }))
    expect(await dialog.findByText('Vui lòng ghi lý do hủy')).toBeVisible()

    await user.type(dialog.getByLabelText('Lý do hủy'), 'Khách hủy hợp đồng trong 15 ngày')
    await user.click(dialog.getByRole('button', { name: 'Hủy hoa hồng' }))

    expect(await screen.findByText(`Đã hủy hoa hồng ${lead.code}`)).toBeVisible()
    expect(db.commissions.find((c) => c.id === approved.id)?.status).toBe('CANCELLED')
  })

  it('offers no actions on paid commissions and filters by affiliate', async () => {
    const ctv1 = findUserByEmail('ctv1@demo.vn')!
    const { user, router } = renderApp('/commissions?status=PAID', { as: 'admin@demo.vn' })
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: /^Duyệt hoa hồng/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Hủy hoa hồng/ })).toBeNull()

    const select = screen.getByLabelText('Cộng tác viên')
    await within(select).findByRole('option', { name: ctv1.fullName })
    await user.selectOptions(select, ctv1.id)

    expect(router.state.location.search).toBe(`?status=PAID&affiliateId=${ctv1.id}`)
  })
})

describe('Payouts (admin)', () => {
  it('generates, confirms and pays a payout; the affiliate is notified', async () => {
    const month = previousMonth(vnMonth(new Date()))
    const ctv2 = findUserByEmail('ctv2@demo.vn')!
    const { user } = renderApp('/payouts', { as: 'admin@demo.vn' })
    await screen.findByRole('table')

    // 1. Generate (a background job; payout:updated refreshes the list).
    await user.click(screen.getByRole('button', { name: 'Tạo kỳ chi trả' }))
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByLabelText('Tháng')).toHaveValue(month)
    await user.click(dialog.getByRole('button', { name: 'Tạo kỳ chi trả' }))
    expect(await screen.findByText(`Đang tạo kỳ chi trả ${formatMonth(month)}`)).toBeVisible()

    const label = `${ctv2.fullName}, ${formatMonth(month)}`
    // 2. Confirm the draft.
    await user.click(await screen.findByRole('button', { name: `Xác nhận kỳ chi trả ${label}` }))
    expect(await screen.findByText(`Đã xác nhận kỳ chi trả của ${ctv2.fullName}`)).toBeVisible()

    // 3. Mark paid after the transfer.
    await user.click(
      await screen.findByRole('button', { name: `Đánh dấu đã chuyển khoản ${label}` }),
    )
    const confirm = within(await screen.findByRole('alertdialog'))
    await user.click(confirm.getByRole('button', { name: 'Đã chuyển khoản' }))
    expect(await screen.findByText(`Đã chi trả cho ${ctv2.fullName}`)).toBeVisible()

    const payout = db.payouts.find((p) => p.affiliateId === ctv2.id && p.periodMonth === month)!
    expect(payout.status).toBe('PAID')
    expect(
      db.commissions.filter((c) => c.payoutId === payout.id).every((c) => c.status === 'PAID'),
    ).toBe(true)
    expect(db.notifications.some((n) => n.userId === ctv2.id && n.type === 'PAYOUT_PAID')).toBe(
      true,
    )
  })
})
