import { screen } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { findUserByEmail } from '@/mocks/db'
import { renderApp } from '@/test/render'

type Values = {
  fullName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

const VALID: Values = {
  fullName: 'Đỗ Thị Mai',
  email: 'mai.do@example.vn',
  phone: '0901 234 567',
  password: 'MatKhau@2026',
  confirmPassword: 'MatKhau@2026',
}

async function fillForm(user: UserEvent, values: Partial<Values> = {}) {
  const v = { ...VALID, ...values }
  if (v.fullName) await user.type(await screen.findByLabelText('Họ và tên'), v.fullName)
  if (v.email) await user.type(screen.getByLabelText('Email'), v.email)
  if (v.phone) await user.type(screen.getByLabelText('Số điện thoại'), v.phone)
  if (v.password) await user.type(screen.getByLabelText('Mật khẩu'), v.password)
  if (v.confirmPassword) {
    await user.type(screen.getByLabelText('Nhập lại mật khẩu'), v.confirmPassword)
  }
  await user.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
}

describe('RegisterPage', () => {
  it('validates phone number, password length and confirmation', async () => {
    const { user } = renderApp('/register')

    await fillForm(user, { phone: '12345', password: 'ngan', confirmPassword: 'khac' })

    expect(await screen.findByText(/Số điện thoại không hợp lệ/)).toBeVisible()
    expect(screen.getByText('Mật khẩu tối thiểu 8 ký tự')).toBeVisible()
    expect(screen.getByText('Mật khẩu nhập lại không khớp')).toBeVisible()
  })

  it('shows a field error when the email is already registered', async () => {
    const { user } = renderApp('/register')

    await fillForm(user, { email: 'ctv1@demo.vn' })

    expect(await screen.findByText('Email này đã được đăng ký')).toBeVisible()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('creates an affiliate account, logs in and shows the new referral code', async () => {
    const { user, router } = renderApp('/register')

    await fillForm(user)

    expect(await screen.findByRole('heading', { name: 'Xin chào, Đỗ Thị Mai' })).toBeVisible()
    expect(screen.getAllByText('CTV004').length).toBeGreaterThan(0)
    expect(router.state.location.pathname).toBe('/')

    const created = findUserByEmail('mai.do@example.vn')
    expect(created).toMatchObject({ role: 'AFFILIATE', phone: '0901234567' })
  })
})
