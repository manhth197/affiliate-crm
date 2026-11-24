import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, findUserByEmail } from '@/mocks/db'
import { renderApp } from '@/test/render'

describe('UsersPage (admin)', () => {
  it('lists all accounts and filters by role', async () => {
    const { user, router } = renderApp('/users', { as: 'admin@demo.vn' })

    const table = within(await screen.findByRole('table'))
    expect(table.getAllByRole('row').slice(1)).toHaveLength(db.users.length)
    expect(table.getByText('(bạn)')).toBeVisible()

    await user.selectOptions(screen.getByLabelText('Vai trò'), 'AFFILIATE')

    expect(await screen.findByText('1–3 trên 3 người dùng')).toBeVisible()
    expect(router.state.location.search).toBe('?role=AFFILIATE')
  })

  it('creates a staff account and reports a taken email on the field', async () => {
    const { user } = renderApp('/users', { as: 'admin@demo.vn' })
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Thêm nhân viên' }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.type(dialog.getByLabelText('Họ và tên'), 'Đỗ Minh Khoa')
    await user.type(dialog.getByLabelText('Email'), 'staff@demo.vn')
    await user.type(dialog.getByLabelText('Số điện thoại'), '0987654000')
    await user.type(dialog.getByLabelText('Mật khẩu tạm'), 'TamThoi@123')
    await user.click(dialog.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await dialog.findByText('Email này đã được sử dụng')).toBeVisible()

    await user.clear(dialog.getByLabelText('Email'))
    await user.type(dialog.getByLabelText('Email'), 'khoa@demo.vn')
    await user.click(dialog.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await screen.findByText('Đã tạo tài khoản cho Đỗ Minh Khoa')).toBeVisible()
    expect(findUserByEmail('khoa@demo.vn')).toMatchObject({ role: 'STAFF', status: 'ACTIVE' })
  })

  it('locks an account after confirmation and ends its sessions', async () => {
    const target = findUserByEmail('ctv2@demo.vn')!
    db.sessions['other-device'] = { userId: target.id, expiresAt: Date.now() + 60_000 }
    const { user } = renderApp('/users', { as: 'admin@demo.vn' })

    await user.click(await screen.findByRole('button', { name: `Khóa ${target.fullName}` }))
    const dialog = within(await screen.findByRole('alertdialog'))
    await user.click(dialog.getByRole('button', { name: 'Khóa tài khoản' }))

    expect(await screen.findByText(`Đã khóa ${target.fullName}`)).toBeVisible()
    expect(findUserByEmail('ctv2@demo.vn')?.status).toBe('DISABLED')
    expect(db.sessions['other-device']).toBeUndefined()
    expect(await screen.findByRole('button', { name: `Mở khóa ${target.fullName}` })).toBeVisible()
  })

  it('does not let an admin lock their own account', async () => {
    renderApp('/users', { as: 'admin@demo.vn' })

    expect(
      await screen.findByRole('button', { name: 'Không thể tự khóa tài khoản của mình' }),
    ).toBeDisabled()
  })

  it('edits name and phone', async () => {
    const target = findUserByEmail('staff@demo.vn')!
    const { user } = renderApp('/users', { as: 'admin@demo.vn' })

    await user.click(await screen.findByRole('button', { name: `Sửa ${target.fullName}` }))
    const dialog = within(await screen.findByRole('dialog'))
    await user.clear(dialog.getByLabelText('Số điện thoại'))
    await user.type(dialog.getByLabelText('Số điện thoại'), '+84 938 000 111')
    await user.click(dialog.getByRole('button', { name: 'Lưu' }))

    expect(await screen.findByText('Đã lưu thông tin')).toBeVisible()
    expect(findUserByEmail('staff@demo.vn')?.phone).toBe('0938000111')
  })
})
