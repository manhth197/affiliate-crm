import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, findUserByEmail } from '@/mocks/db'
import { renderApp } from '@/test/render'

describe('ProfilePage', () => {
  it('lets an affiliate set a bank account, shown back masked', async () => {
    const me = findUserByEmail('ctv3@demo.vn')! // no bank account in the seed
    const { user } = renderApp('/profile', { as: 'ctv3@demo.vn' })

    expect(await screen.findByText('Chưa có tài khoản nhận tiền.')).toBeVisible()
    await user.type(screen.getByLabelText('Ngân hàng'), 'MB Bank')
    await user.type(screen.getByLabelText('Số tài khoản mới'), '12345')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Số tài khoản gồm 6–20 chữ số')).toBeVisible()

    await user.clear(screen.getByLabelText('Số tài khoản mới'))
    await user.type(screen.getByLabelText('Số tài khoản mới'), '0123 4567 89')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText('Hiện tại: MB Bank · ******6789')).toBeVisible()
    expect(screen.getByLabelText('Số tài khoản mới')).toHaveValue('')
    expect(db.affiliates.find((a) => a.userId === me.id)).toMatchObject({
      bankName: 'MB Bank',
      bankAccountMasked: '******6789',
    })
  })

  it('updates name and phone; the header follows', async () => {
    const { user } = renderApp('/profile', { as: 'staff@demo.vn' })

    // Staff have no bank section.
    await screen.findByLabelText('Họ và tên')
    expect(screen.queryByLabelText('Ngân hàng')).toBeNull()

    await user.clear(screen.getByLabelText('Họ và tên'))
    await user.type(screen.getByLabelText('Họ và tên'), 'Lê Thu Hằng')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText('Đã lưu thông tin tài khoản')).toBeVisible()
    expect(findUserByEmail('staff@demo.vn')?.fullName).toBe('Lê Thu Hằng')
    expect(screen.getByRole('button', { name: 'Tài khoản' })).toHaveTextContent('Lê Thu Hằng')
  })

  it('says so when nothing changed', async () => {
    const { user } = renderApp('/profile', { as: 'ctv1@demo.vn' })

    await user.click(await screen.findByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText('Không có thay đổi nào')).toBeVisible()
  })
})
