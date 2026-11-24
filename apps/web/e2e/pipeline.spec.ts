import { expect, type Page, test } from '@playwright/test'
import {
  dragCard,
  login,
  logout,
  newUserPage,
  randomPhone,
  registerAffiliate,
  toast,
  unreadCount,
  vnMonth,
} from './helpers'

/**
 * The whole money path, with two people at once: a new affiliate refers a customer and
 * watches; staff and then an admin work the lead. Realtime updates are checked on the
 * affiliate's screen without reloading.
 */
test.describe.serial('lead → commission → payout', () => {
  let affiliatePage: Page
  let opsPage: Page
  let affiliateName: string
  let leadCode: string
  let leadUrl: string
  const customer = `Khách E2E ${Date.now().toString(36).slice(-4)}`
  const phone = randomPhone()

  test.beforeAll(async ({ browser }) => {
    affiliatePage = (await newUserPage(browser)).page
    opsPage = (await newUserPage(browser)).page
    affiliateName = (await registerAffiliate(affiliatePage)).name
  })

  test('the affiliate refers a customer; a duplicate is refused', async () => {
    const page = affiliatePage
    async function fillForm() {
      await page.goto('/leads/new')
      const product = page.getByLabel('Sản phẩm')
      const loan = await product
        .locator('optgroup[label="Vay"] option')
        .first()
        .getAttribute('value')
      await product.selectOption(loan!)
      await page.getByLabel('Họ tên khách hàng').fill(customer)
      await page.getByLabel('Số điện thoại khách hàng').fill(phone)
      await page.getByLabel('Số tiền khách muốn vay').pressSequentially('60000000')
      await page.getByRole('button', { name: 'Gửi thông tin' }).click()
    }

    await fillForm()
    await expect(page.getByRole('heading', { name: customer })).toBeVisible()
    leadUrl = page.url()
    leadCode = (await page.getByText(/^LD-\d+ · Tạo lúc/).textContent())!.split(' ')[0]!
    await expect(page.getByText(/\d{2}\*{6}\d{2}/)).toBeVisible() // phone masked

    await fillForm()
    await expect(
      page.getByText('Khách hàng này đã có hồ sơ đang xử lý cho sản phẩm này.'),
    ).toBeVisible()
  })

  test('staff move it to DISBURSED; the affiliate sees it live', async () => {
    await affiliatePage.goto(leadUrl)
    await expect(affiliatePage.getByRole('heading', { name: customer })).toBeVisible()
    const unread = await unreadCount(affiliatePage)

    await login(opsPage, 'staff@demo.vn')
    await opsPage.goto(`/leads?q=${encodeURIComponent(leadCode)}`)
    await expect(
      opsPage.getByRole('button', { name: new RegExp(`^Kéo ${leadCode} `) }),
    ).toBeVisible()
    await dragCard(opsPage, leadCode, 'Đã liên hệ')
    await expect(toast(opsPage, `${leadCode}: Đã liên hệ`)).toBeVisible()

    // Realtime, no reload on the affiliate's side.
    await expect(toast(affiliatePage, leadCode)).toBeVisible()
    await expect.poll(() => unreadCount(affiliatePage)).toBeGreaterThan(unread)
    await expect(
      affiliatePage.getByRole('heading', { name: customer }).locator('..').getByText('Đã liên hệ'),
    ).toBeVisible()

    await opsPage.goto(new URL(leadUrl).pathname)
    for (const next of ['Đã nộp hồ sơ', 'Đã duyệt']) {
      await opsPage.getByRole('button', { name: `→ ${next}` }).click()
      await opsPage.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click()
      await expect(toast(opsPage, `${leadCode}: ${next}`)).toBeVisible()
    }
    await opsPage.getByRole('button', { name: '→ Đã giải ngân' }).click()
    const amount = opsPage.getByRole('dialog').getByLabel('Số tiền giải ngân')
    await expect(amount).toHaveValue('60.000.000')
    await amount.fill('')
    await amount.pressSequentially('55000000')
    await opsPage.getByRole('dialog').getByRole('button', { name: 'Xác nhận' }).click()
    await expect(toast(opsPage, `${leadCode}: Đã giải ngân`)).toBeVisible()

    // The commission is created by a background job and announced live.
    await expect(toast(affiliatePage, /hoa hồng/i)).toBeVisible({ timeout: 30_000 })
    await logout(opsPage)
  })

  test('an admin approves the commission and pays it out', async () => {
    await login(opsPage, 'admin@demo.vn')
    await opsPage.goto('/commissions?status=PENDING')
    await opsPage.getByRole('button', { name: `Duyệt hoa hồng ${leadCode}` }).click()
    await expect(toast(opsPage, `Đã duyệt hoa hồng ${leadCode}`)).toBeVisible()

    const month = vnMonth()
    const monthLabel = `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`
    await opsPage.goto('/payouts')
    await opsPage.getByRole('button', { name: 'Tạo kỳ chi trả' }).click()
    await opsPage.getByRole('dialog').getByLabel('Tháng').selectOption(month)
    await opsPage.getByRole('dialog').getByRole('button', { name: 'Tạo kỳ chi trả' }).click()

    const label = `${affiliateName}, ${monthLabel}`
    await opsPage
      .getByRole('button', { name: `Xác nhận kỳ chi trả ${label}` })
      .click({ timeout: 30_000 })
    await expect(toast(opsPage, `Đã xác nhận kỳ chi trả của ${affiliateName}`)).toBeVisible()
    await opsPage.getByRole('button', { name: `Đánh dấu đã chuyển khoản ${label}` }).click()
    await opsPage.getByRole('alertdialog').getByRole('button', { name: 'Đã chuyển khoản' }).click()
    await expect(toast(opsPage, `Đã chi trả cho ${affiliateName}`)).toBeVisible()

    await expect(toast(affiliatePage, /chi trả/i)).toBeVisible({ timeout: 30_000 })
  })

  test('reports show figures and charts', async () => {
    await opsPage.goto('/reports')
    await expect(opsPage.getByRole('table', { name: 'Cộng tác viên dẫn đầu' })).toBeVisible()
    await expect(opsPage.locator('.recharts-bar-rectangle').first()).toBeVisible()
  })

  test('the affiliate saves a bank account, shown masked', async () => {
    await affiliatePage.goto('/profile')
    await affiliatePage.getByLabel('Ngân hàng').fill('Vietcombank')
    await affiliatePage.getByLabel('Số tài khoản mới').fill('0123 4567 8901')
    await affiliatePage.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(affiliatePage.getByText(/Hiện tại: Vietcombank · \*+8901/)).toBeVisible()
  })
})
