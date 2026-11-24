import { type Browser, expect, type Page } from '@playwright/test'

export const DEMO_PASSWORD = 'Demo@12345'

/** A unique, valid Vietnamese mobile number. */
export function randomPhone() {
  return `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
}

/** A new page in its own browser context (= its own cookies, like another person's browser). */
export async function newUserPage(browser: Browser) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    // The duplicate-lead step answers 409 on purpose; the browser logs failed requests.
    if (message.type() === 'error' && !message.text().includes('409')) {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  return { page, consoleErrors }
}

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Xin chào/ })).toBeVisible()
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Tài khoản' }).click()
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click()
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible()
}

/** Register a fresh affiliate (logged in afterwards). */
export async function registerAffiliate(page: Page) {
  const id = `${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 100)}`
  const affiliate = {
    name: `CTV E2E ${id}`,
    email: `e2e-${id}@example.test`,
    password: 'E2e@12345',
  }
  await page.goto('/register')
  await page.getByLabel('Họ và tên').fill(affiliate.name)
  await page.getByLabel('Email').fill(affiliate.email)
  await page.getByLabel('Số điện thoại').fill(randomPhone())
  await page.getByLabel('Mật khẩu', { exact: true }).fill(affiliate.password)
  await page.getByLabel('Nhập lại mật khẩu').fill(affiliate.password)
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()
  await expect(page.getByRole('heading', { name: `Xin chào, ${affiliate.name}` })).toBeVisible()
  return affiliate
}

export const toast = (page: Page, text: string | RegExp) =>
  page.locator('[data-sonner-toast]').filter({ hasText: text }).first()

export async function unreadCount(page: Page) {
  const label = await page.getByRole('button', { name: /^Thông báo/ }).getAttribute('aria-label')
  return Number(label?.match(/(\d+) chưa đọc/)?.[1] ?? 0)
}

/** Drag a kanban card by its handle onto a column (pointer events, like a user). */
export async function dragCard(page: Page, leadCode: string, toColumn: string) {
  const handle = page.getByRole('button', { name: new RegExp(`^Kéo ${leadCode} `) })
  const from = await handle.boundingBox()
  const to = await page.getByRole('region', { name: `Cột ${toColumn}` }).boundingBox()
  if (!from || !to) throw new Error('kanban card or column not visible')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + 100, { steps: 15 })
  await page.mouse.up()
}

/** "YYYY-MM" of today in Vietnam. */
export function vnMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
}
