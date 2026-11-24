import { screen, within } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, findUserByEmail } from '@/mocks/db'
import { api, businessError } from '@/mocks/http'
import { server } from '@/mocks/node'
import { renderApp } from '@/test/render'

const firstLead = (status: string) => db.leads.find((l) => l.status === status)!

async function openAsStaff(leadId: string) {
  const app = renderApp(`/leads/${leadId}`, { as: 'staff@demo.vn' })
  await screen.findByRole('heading', { name: 'Xử lý lead' })
  await screen.findByRole('list', { name: 'Lịch sử xử lý' })
  return app
}

describe('Lead actions (staff)', () => {
  it('moves a lead to the next status with an optional note', async () => {
    const lead = firstLead('NEW')
    const { user } = await openAsStaff(lead.id)

    await user.click(screen.getByRole('button', { name: '→ Đã liên hệ' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.type(dialog.getByLabelText('Ghi chú (không bắt buộc)'), 'Đã gọi, khách đồng ý')
    await user.click(dialog.getByRole('button', { name: 'Xác nhận' }))

    expect(await screen.findByText(`${lead.code}: Đã liên hệ`)).toBeVisible()
    const timeline = within(screen.getByRole('list', { name: 'Lịch sử xử lý' }))
    expect(await timeline.findByText('Chuyển trạng thái: Mới → Đã liên hệ')).toBeVisible()
    expect(timeline.getByText('Đã gọi, khách đồng ý')).toBeVisible()
    expect(db.leads.find((l) => l.id === lead.id)?.status).toBe('CONTACTED')
    // The next step is offered now.
    expect(await screen.findByRole('button', { name: '→ Đã nộp hồ sơ' })).toBeVisible()
  })

  it('asks for the disbursed amount (prefilled) and creates a commission', async () => {
    const lead = db.leads.find((l) => l.status === 'APPROVED' && l.requestedAmount)!
    const { user } = await openAsStaff(lead.id)

    await user.click(screen.getByRole('button', { name: '→ Đã giải ngân' }))
    const dialog = within(await screen.findByRole('dialog'))
    const amount = dialog.getByLabelText('Số tiền giải ngân')
    expect(amount).toHaveValue(new Intl.NumberFormat('vi-VN').format(lead.requestedAmount!))

    await user.clear(amount)
    await user.click(dialog.getByRole('button', { name: 'Xác nhận' }))
    expect(await dialog.findByText('Vui lòng nhập số tiền giải ngân')).toBeVisible()

    await user.type(amount, '30000000')
    await user.click(dialog.getByRole('button', { name: 'Xác nhận' }))

    expect(await screen.findByText(`${lead.code}: Đã giải ngân`)).toBeVisible()
    const updated = db.leads.find((l) => l.id === lead.id)!
    expect(updated).toMatchObject({ status: 'DISBURSED', disbursedAmount: 30_000_000 })
    expect(db.commissions.some((c) => c.leadId === lead.id && c.status === 'PENDING')).toBe(true)
  })

  it('requires a reason to reject', async () => {
    const lead = firstLead('CONTACTED')
    const { user } = await openAsStaff(lead.id)

    await user.click(screen.getByRole('button', { name: 'Từ chối' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Từ chối' }))
    expect(await dialog.findByText('Vui lòng ghi lý do từ chối')).toBeVisible()

    await user.type(dialog.getByLabelText('Lý do từ chối'), 'Khách không đủ thu nhập')
    await user.click(dialog.getByRole('button', { name: 'Từ chối' }))

    expect(await screen.findByText(`${lead.code}: Từ chối`)).toBeVisible()
    expect(await screen.findByText('Lead đã ở trạng thái cuối.')).toBeVisible()
  })

  it('reloads the lead when someone else changed it first (409 CONCURRENT_UPDATE)', async () => {
    const lead = firstLead('NEW')
    server.use(
      http.patch(api('/leads/:id/status'), () => {
        // Simulate the other user's change landing first.
        db.leads.find((l) => l.id === lead.id)!.status = 'CONTACTED'
        return businessError(409, 'CONCURRENT_UPDATE', 'Lead was changed by someone else')
      }),
    )
    const { user } = await openAsStaff(lead.id)

    await user.click(screen.getByRole('button', { name: '→ Đã liên hệ' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận' }),
    )

    expect(await screen.findByText(/Lead vừa được người khác cập nhật/)).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The page now shows the server's state and the matching next step.
    expect(await screen.findByRole('button', { name: '→ Đã nộp hồ sơ' })).toBeVisible()
  })

  it('assigns the lead to another person', async () => {
    const lead = db.leads.find((l) => l.status === 'NEW' && !l.assignedStaffId)!
    const admin = findUserByEmail('admin@demo.vn')!
    const { user } = await openAsStaff(lead.id)

    const select = screen.getByLabelText('Nhân viên phụ trách')
    await within(select).findByRole('option', { name: /Trần Minh Quân/ })
    await user.selectOptions(select, admin.id)
    await user.click(screen.getByRole('button', { name: 'Giao' }))

    expect(await screen.findByText(`Đã giao ${lead.code} cho ${admin.fullName}`)).toBeVisible()
    const timeline = within(screen.getByRole('list', { name: 'Lịch sử xử lý' }))
    expect(await timeline.findByText(`Phân công cho ${admin.fullName}`)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Giao' })).toBeDisabled() // already assigned
  })

  it('adds an internal note to the timeline', async () => {
    const lead = firstLead('SUBMITTED')
    const { user } = await openAsStaff(lead.id)

    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }))
    expect(await screen.findByText('Vui lòng nhập nội dung ghi chú')).toBeVisible()

    await user.type(screen.getByLabelText('Ghi chú nội bộ'), 'Chờ đối tác thẩm định')
    await user.click(screen.getByRole('button', { name: 'Thêm ghi chú' }))

    const timeline = within(screen.getByRole('list', { name: 'Lịch sử xử lý' }))
    expect(await timeline.findByText('Chờ đối tác thẩm định')).toBeVisible()
    expect(screen.getByLabelText('Ghi chú nội bộ')).toHaveValue('')
  })

  it('does not show actions to the affiliate who owns the lead', async () => {
    const me = findUserByEmail('ctv1@demo.vn')!
    const lead = db.leads.find((l) => l.affiliateId === me.id && l.status === 'NEW')!
    renderApp(`/leads/${lead.id}`, { as: 'ctv1@demo.vn' })

    await screen.findByRole('heading', { name: lead.customerName })
    expect(screen.queryByRole('heading', { name: 'Xử lý lead' })).not.toBeInTheDocument()
  })
})
