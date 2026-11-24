import { expect, test } from '@playwright/test'
import { login, logout, newUserPage, registerAffiliate } from './helpers'

test.describe('auth', () => {
  for (const email of ['admin@demo.vn', 'staff@demo.vn', 'ctv1@demo.vn']) {
    test(`logs in as ${email}`, async ({ browser }) => {
      const { page, consoleErrors } = await newUserPage(browser)
      await login(page, email)
      await logout(page)
      expect(consoleErrors).toEqual([])
    })
  }

  test('keeps the refresh token in an httpOnly cookie and survives a reload', async ({
    browser,
  }) => {
    const { page } = await newUserPage(browser)
    const affiliate = await registerAffiliate(page)

    // Whichever origin serves the API (dev: :3000, Docker: same origin), the cookie is httpOnly.
    const cookies = await page.context().cookies()
    const refreshCookie = cookies.find((c) => c.name === 'crm_rt')
    expect(refreshCookie?.httpOnly).toBe(true)
    expect(await page.evaluate(() => document.cookie)).not.toContain('crm_rt')
    expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain(
      'affiliate-crm.refreshToken',
    )

    await page.reload()
    await expect(page.getByRole('heading', { name: `Xin chào, ${affiliate.name}` })).toBeVisible()

    await logout(page)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
    expect((await page.context().cookies()).some((c) => c.name === 'crm_rt')).toBe(false)
  })
})
