import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Role } from '@/api/types'
import { NAV_ITEMS } from '@/lib/navigation'
import { renderApp, type DemoEmail } from '@/test/render'

const EMAIL_BY_ROLE: Record<Role, DemoEmail> = {
  ADMIN: 'admin@demo.vn',
  STAFF: 'staff@demo.vn',
  AFFILIATE: 'ctv1@demo.vn',
}

async function sidebarLinks() {
  const nav = await screen.findByRole('navigation', { name: 'Menu chính' })
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent)
}

describe('route guards', () => {
  it('sends guests to the login page and back to the requested page after login', async () => {
    const { user, router } = renderApp('/users?status=ACTIVE')

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'admin@demo.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), 'Demo@12345')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    expect(await screen.findByRole('heading', { name: 'Người dùng' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/users')
    expect(router.state.location.search).toBe('?status=ACTIVE')
  })

  it('shows a 403 screen when an affiliate opens an admin page', async () => {
    renderApp('/users', { as: 'ctv1@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Người dùng' })).not.toBeInTheDocument()
  })

  it('shows a 403 screen when staff opens the affiliate-only create form', async () => {
    renderApp('/leads/new', { as: 'staff@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
  })

  it('lets an admin open admin pages', async () => {
    renderApp('/products', { as: 'admin@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Sản phẩm' })).toBeVisible()
  })

  it('redirects a logged-in user away from the login page', async () => {
    const { router } = renderApp('/login', { as: 'ctv1@demo.vn' })

    expect(await screen.findByRole('heading', { name: /Xin chào, Nguyễn Văn An/ })).toBeVisible()
    expect(router.state.location.pathname).toBe('/')
  })

  it('shows a not-found page for unknown URLs inside the app', async () => {
    renderApp('/khong-ton-tai', { as: 'staff@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
  })
})

describe('menu by role', () => {
  it('shows the affiliate menu', async () => {
    renderApp('/', { as: 'ctv1@demo.vn' })

    expect(await sidebarLinks()).toEqual([
      'Tổng quan',
      'Lead của tôi',
      'Giới thiệu khách hàng',
      'Hoa hồng',
      'Chi trả',
    ])
  })

  it('shows the staff menu', async () => {
    renderApp('/', { as: 'staff@demo.vn' })

    expect(await sidebarLinks()).toEqual(['Tổng quan', 'Pipeline', 'Báo cáo'])
  })

  it('shows the full admin menu', async () => {
    renderApp('/', { as: 'admin@demo.vn' })

    expect(await sidebarLinks()).toEqual([
      'Tổng quan',
      'Pipeline',
      'Hoa hồng',
      'Chi trả',
      'Sản phẩm',
      'Người dùng',
      'Báo cáo',
    ])
  })

  it('marks the current page in the menu', async () => {
    renderApp('/leads/new', { as: 'ctv1@demo.vn' })

    const nav = await screen.findByRole('navigation', { name: 'Menu chính' })
    expect(within(nav).getByRole('link', { name: 'Giới thiệu khách hàng' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Lead của tôi' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  // Keeps NAV_ITEMS and the <RequireRole> wrappers in routes.tsx in sync.
  it.each(NAV_ITEMS.flatMap((item) => item.roles.map((role) => [role, item.to] as const)))(
    '%s can open its menu link %s',
    async (role, path) => {
      renderApp(path, { as: EMAIL_BY_ROLE[role] })

      await screen.findByRole('navigation', { name: 'Menu chính' })
      expect(screen.queryByText('Không có quyền truy cập')).not.toBeInTheDocument()
      expect(screen.queryByText('Không tìm thấy trang')).not.toBeInTheDocument()
    },
  )
})
