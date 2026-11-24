import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, findUserByEmail } from '@/mocks/db'
import { renderApp } from '@/test/render'

const ctv1Leads = () => {
  const me = findUserByEmail('ctv1@demo.vn')!
  return db.leads.filter((l) => l.affiliateId === me.id)
}

async function table() {
  return within(await screen.findByRole('table'))
}

describe('LeadsPage (affiliate)', () => {
  it('lists only my leads, newest first, with masked phone numbers', async () => {
    renderApp('/leads', { as: 'ctv1@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Lead của tôi' })).toBeVisible()
    const rows = (await table()).getAllByRole('row').slice(1) // skip the header row
    expect(rows).toHaveLength(20)

    const newest = [...ctv1Leads()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!
    expect(within(rows[0]!).getByText(newest.code)).toBeVisible()
    expect(within(rows[0]!).getByText(/^\d{2}\*{6}\d{2}$/)).toBeVisible()
    expect(screen.getByText(`1–20 trên ${ctv1Leads().length} lead`)).toBeVisible()
    // Affiliates do not get the back-office columns.
    expect((await table()).queryByText('Cộng tác viên')).not.toBeInTheDocument()
  })

  it('pages through results and keeps the page in the URL', async () => {
    const { user, router } = renderApp('/leads', { as: 'ctv1@demo.vn' })
    await table()

    await user.click(screen.getByRole('button', { name: /Sau/ }))

    expect(await screen.findByText(`21–40 trên ${ctv1Leads().length} lead`)).toBeVisible()
    expect(router.state.location.search).toBe('?page=2')
  })

  it('filters by status through the URL', async () => {
    const { user, router } = renderApp('/leads?page=2', { as: 'ctv1@demo.vn' })
    await table()

    await user.selectOptions(screen.getByLabelText('Trạng thái'), 'REJECTED')

    const expected = ctv1Leads().filter((l) => l.status === 'REJECTED').length
    expect(await screen.findByText(new RegExp(`trên ${expected} lead$`))).toBeVisible()
    // A new filter starts again from page 1.
    expect(router.state.location.search).toBe('?status=REJECTED')
    const statuses = (await table()).getAllByRole('row').slice(1)
    for (const row of statuses) expect(within(row).getByText('Từ chối')).toBeVisible()
  })

  it('searches by customer name without typing Vietnamese accents', async () => {
    const target = ctv1Leads()[0]!
    const plain = target.customerName
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
    const { user, router } = renderApp('/leads', { as: 'ctv1@demo.vn' })
    await table()

    await user.type(screen.getByLabelText('Tìm lead'), plain)

    // Debounced search (400 ms) + request: allow more than the default 1 s under a busy CI.
    expect(await screen.findByText(target.code, {}, { timeout: 3000 })).toBeVisible()
    expect(router.state.location.search).toContain('q=')
  })

  it('offers a way back when the page number is past the end', async () => {
    const { user, router } = renderApp('/leads?page=99', { as: 'ctv1@demo.vn' })

    await user.click(await screen.findByRole('button', { name: 'Về trang đầu' }))

    expect(await screen.findByText(`1–20 trên ${ctv1Leads().length} lead`)).toBeVisible()
    expect(router.state.location.search).toBe('')
  })

  it('explains an empty result and clears the filters', async () => {
    const { user } = renderApp('/leads?q=khongtontai', { as: 'ctv1@demo.vn' })

    expect(await screen.findByText('Không có lead nào khớp bộ lọc')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Xóa lọc' }))

    expect(await screen.findByText(`1–20 trên ${ctv1Leads().length} lead`)).toBeVisible()
    expect(screen.getByLabelText('Tìm lead')).toHaveValue('')
  })
})

describe('LeadsPage (staff, table view)', () => {
  it('shows the whole pipeline with affiliate and assignee columns', async () => {
    renderApp('/leads?view=table', { as: 'staff@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Pipeline' })).toBeVisible()
    const t = await table()
    expect(t.getByRole('columnheader', { name: 'Cộng tác viên' })).toBeVisible()
    expect(t.getByRole('columnheader', { name: 'Phụ trách' })).toBeVisible()
    expect(screen.getByText(`1–20 trên ${db.leads.length} lead`)).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Giới thiệu khách hàng' })).toBeNull()
  })
})
