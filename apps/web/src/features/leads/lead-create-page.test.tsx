import { screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '@/mocks/db'
import { renderApp } from '@/test/render'

const productOption = (category: 'LOAN' | 'CREDIT_CARD') =>
  db.products.find((p) => p.category === category && p.active)!

async function openForm() {
  const app = renderApp('/leads/new', { as: 'ctv1@demo.vn' })
  await screen.findByRole('heading', { name: 'Giới thiệu khách hàng' })
  await screen.findByLabelText('Sản phẩm')
  return app
}

async function fillCustomer(
  user: UserEvent,
  { name = 'Trịnh Văn Tài', phone = '0912 000 111' } = {},
) {
  await user.type(screen.getByLabelText('Họ tên khách hàng'), name)
  await user.type(screen.getByLabelText('Số điện thoại khách hàng'), phone)
}

describe('LeadCreatePage', () => {
  it('asks for the loan amount only for loan products', async () => {
    const { user } = await openForm()

    await user.selectOptions(screen.getByLabelText('Sản phẩm'), productOption('CREDIT_CARD').id)
    expect(screen.queryByLabelText('Số tiền khách muốn vay')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Sản phẩm'), productOption('LOAN').id)
    expect(screen.getByLabelText('Số tiền khách muốn vay')).toBeVisible()
    // The commission rule of the chosen product is shown under the select.
    expect(screen.getByText(/Hoa hồng: 1,5% số tiền giải ngân/)).toBeVisible()
  })

  it('validates the form before sending', async () => {
    const { user } = await openForm()

    await user.click(screen.getByRole('button', { name: 'Gửi thông tin' }))

    expect(await screen.findByText('Vui lòng chọn sản phẩm')).toBeVisible()
    expect(screen.getByText('Vui lòng nhập họ tên khách hàng')).toBeVisible()
    expect(screen.getByText('Vui lòng nhập số điện thoại')).toBeVisible()
  })

  it('requires an amount for loans and checks the CMND/CCCD length', async () => {
    const { user } = await openForm()

    await user.selectOptions(screen.getByLabelText('Sản phẩm'), productOption('LOAN').id)
    await fillCustomer(user)
    await user.type(screen.getByLabelText('Số CMND/CCCD (không bắt buộc)'), '0123456789')
    await user.click(screen.getByRole('button', { name: 'Gửi thông tin' }))

    expect(await screen.findByText('Số CMND/CCCD gồm 9 hoặc 12 chữ số')).toBeVisible()

    await user.clear(screen.getByLabelText('Số CMND/CCCD (không bắt buộc)'))
    await user.click(screen.getByRole('button', { name: 'Gửi thông tin' }))
    expect(await screen.findByText('Vui lòng nhập số tiền khách muốn vay')).toBeVisible()
  })

  it('formats the amount as the user types', async () => {
    const { user } = await openForm()
    await user.selectOptions(screen.getByLabelText('Sản phẩm'), productOption('LOAN').id)

    await user.type(screen.getByLabelText('Số tiền khách muốn vay'), '50000000')

    expect(screen.getByLabelText('Số tiền khách muốn vay')).toHaveValue('50.000.000')
  })

  it('creates the lead and opens its detail page', async () => {
    const { user, router } = await openForm()
    const loan = productOption('LOAN')

    await user.selectOptions(screen.getByLabelText('Sản phẩm'), loan.id)
    await fillCustomer(user)
    await user.type(screen.getByLabelText('Số tiền khách muốn vay'), '50000000')
    await user.type(screen.getByLabelText('Ghi chú cho nhân viên (không bắt buộc)'), 'Gọi sau 17h')
    await user.click(screen.getByRole('button', { name: 'Gửi thông tin' }))

    expect(await screen.findByRole('heading', { name: 'Trịnh Văn Tài' })).toBeVisible()
    expect(await screen.findByText('Đã gửi lead LD-000121')).toBeVisible()
    expect(router.state.location.pathname).toBe(`/leads/${db.leads.at(-1)!.id}`)
    expect(db.leads.at(-1)).toMatchObject({
      productId: loan.id,
      customerPhone: '0912000111',
      requestedAmount: 50_000_000,
      status: 'NEW',
    })
    // The affiliate's note shows in the timeline.
    expect(await screen.findByText('Gọi sau 17h')).toBeVisible()
  })

  it('explains when the customer already has an open lead for the product', async () => {
    const { user } = await openForm()
    const open = db.leads.find(
      (l) =>
        l.status === 'NEW' && db.products.find((p) => p.id === l.productId)?.category !== 'LOAN',
    )!

    await user.selectOptions(screen.getByLabelText('Sản phẩm'), open.productId)
    await fillCustomer(user, { phone: open.customerPhone })
    await user.click(screen.getByRole('button', { name: 'Gửi thông tin' }))

    expect(
      await screen.findByText('Khách hàng này đã có hồ sơ đang xử lý cho sản phẩm này.'),
    ).toBeVisible()
  })
})
