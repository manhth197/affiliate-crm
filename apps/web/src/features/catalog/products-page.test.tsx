import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/mocks/db'
import { renderApp } from '@/test/render'
import { asText } from '@/test/text'
import { basisPointsToPercent, percentToBasisPoints } from './commission-input'

describe('commission input helpers', () => {
  it('converts typed percentages to basis points and back', () => {
    expect(percentToBasisPoints('1,5')).toBe(150)
    expect(percentToBasisPoints('1.25')).toBe(125)
    expect(percentToBasisPoints('2')).toBe(200)
    expect(percentToBasisPoints('1,234')).toBeNull() // max 2 decimals
    expect(percentToBasisPoints('abc')).toBeNull()
    expect(basisPointsToPercent(150)).toBe('1,5')
  })
})

describe('ProductsPage (admin)', () => {
  it('lists every product, including inactive ones, with its commission rule', async () => {
    renderApp('/products', { as: 'admin@demo.vn' })

    const table = within(await screen.findByRole('table'))
    expect(table.getAllByRole('row').slice(1)).toHaveLength(db.products.length)
    expect(table.getByText('1,5% số tiền giải ngân')).toBeVisible()
    expect(table.getByText(asText('300.000 ₫ / hồ sơ thành công'))).toBeVisible()
    const inactive = db.products.find((p) => !p.active)!
    expect(table.getByRole('switch', { name: `Nhận hồ sơ: ${inactive.name}` })).not.toBeChecked()
  })

  it('pauses a product with the switch', async () => {
    const product = db.products.find((p) => p.active)!
    const { user } = renderApp('/products', { as: 'admin@demo.vn' })

    await user.click(await screen.findByRole('switch', { name: `Nhận hồ sơ: ${product.name}` }))

    expect(await screen.findByText(`Đã tạm ngừng nhận hồ sơ “${product.name}”`)).toBeVisible()
    expect(db.products.find((p) => p.id === product.id)?.active).toBe(false)
  })

  it('creates a product with a percentage commission stored in basis points', async () => {
    const { user } = renderApp('/products', { as: 'admin@demo.vn' })
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Thêm sản phẩm' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.click(dialog.getByRole('button', { name: 'Thêm sản phẩm' }))
    expect(await dialog.findByText('Vui lòng nhập tên sản phẩm')).toBeVisible()

    await user.type(dialog.getByLabelText('Tên sản phẩm'), 'Vay kinh doanh hộ gia đình')
    await user.type(dialog.getByLabelText('Đối tác'), 'MB Bank')
    await user.type(dialog.getByLabelText('Tỉ lệ hoa hồng (%)'), '1,2')
    await user.click(dialog.getByRole('button', { name: 'Thêm sản phẩm' }))

    expect(await screen.findByText('Đã thêm “Vay kinh doanh hộ gia đình”')).toBeVisible()
    expect(db.products.at(-1)).toMatchObject({
      name: 'Vay kinh doanh hộ gia đình',
      partnerName: 'MB Bank',
      category: 'LOAN',
      commissionType: 'PERCENT',
      commissionValue: 120,
      active: true,
    })
  })

  it('edits a fixed commission', async () => {
    const product = db.products.find((p) => p.commissionType === 'FIXED' && p.active)!
    const { user } = renderApp('/products', { as: 'admin@demo.vn' })

    await user.click(await screen.findByRole('button', { name: `Sửa ${product.name}` }))
    const dialog = within(await screen.findByRole('dialog'))
    const amount = dialog.getByLabelText('Hoa hồng mỗi hồ sơ thành công')
    await user.clear(amount)
    await user.type(amount, '350000')
    await user.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText(`Đã cập nhật “${product.name}”`)).toBeVisible()
    expect(db.products.find((p) => p.id === product.id)?.commissionValue).toBe(350_000)
  })
})
