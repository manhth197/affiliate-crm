import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/mocks/db'
import { renderApp } from '@/test/render'

describe('LoginPage', () => {
  it('validates the fields before calling the API', async () => {
    const { user } = renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByText('Vui lòng nhập email')).toBeVisible()
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeVisible()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('rejects a malformed email', async () => {
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'khong-phai-email')
    await user.type(screen.getByLabelText('Mật khẩu'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByText('Email không hợp lệ')).toBeVisible()
  })

  it('shows a clear message for a wrong password', async () => {
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'ctv1@demo.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), 'sai-mat-khau')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByText('Email hoặc mật khẩu không đúng.')).toBeVisible()
  })

  it('tells a disabled user their account is locked', async () => {
    db.users.find((u) => u.email === 'ctv2@demo.vn')!.status = 'DISABLED'
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'ctv2@demo.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), 'Demo@12345')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByText(/Tài khoản của bạn đã bị khóa/)).toBeVisible()
  })

  it('logs in and opens the dashboard', async () => {
    const { user, router } = renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'ctv1@demo.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), 'Demo@12345')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByRole('heading', { name: 'Xin chào, Nguyễn Văn An' })).toBeVisible()
    expect(screen.getByText('CTV001')).toBeVisible()
    expect(router.state.location.pathname).toBe('/')
  })

  it('fills a demo account with one click', async () => {
    const { user } = renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Quản trị viên' }))

    expect(screen.getByLabelText('Email')).toHaveValue('admin@demo.vn')
    expect(screen.getByLabelText('Mật khẩu')).toHaveValue('Demo@12345')
  })

  it('logs out from the user menu and revokes the refresh token', async () => {
    const { user } = renderApp('/', { as: 'staff@demo.vn' })

    await user.click(await screen.findByRole('button', { name: 'Tài khoản' }))
    const menu = await screen.findByRole('menu')
    await user.click(within(menu).getByRole('menuitem', { name: 'Đăng xuất' }))

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
    expect(Object.keys(db.sessions)).toHaveLength(0)
  })

  it('sends the next user to their own home page after an explicit logout', async () => {
    const lead = db.leads[0]!
    const { user, router } = renderApp(`/leads/${lead.id}`, { as: 'staff@demo.vn' })

    await user.click(await screen.findByRole('button', { name: 'Tài khoản' }))
    await user.click(
      within(await screen.findByRole('menu')).getByRole('menuitem', { name: 'Đăng xuất' }),
    )
    await screen.findByRole('heading', { name: 'Đăng nhập' })

    await user.type(screen.getByLabelText('Email'), 'admin@demo.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), 'Demo@12345')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByRole('heading', { name: /Xin chào/ })).toBeVisible()
    expect(router.state.location.pathname).toBe('/')
  })
})
