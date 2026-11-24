import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, findUserByEmail } from '@/mocks/db'
import { api } from '@/mocks/http'
import { issueTokens } from '@/mocks/tokens'
import { renderApp } from '@/test/render'

const ctv1 = () => findUserByEmail('ctv1@demo.vn')!
const unreadOf = (userId: string) =>
  db.notifications.filter((n) => n.userId === userId && n.readAt === null).length

/** Another person (staff, in their own browser) acting through the API. */
async function asStaff(path: string, body: object) {
  const staff = findUserByEmail('staff@demo.vn')!
  const { accessToken } = issueTokens(staff.id)
  const response = await fetch(api(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  })
  expect(response.ok).toBe(true)
}

describe('Notifications', () => {
  it('shows the unread count on the bell and lists the latest notifications', async () => {
    const unread = unreadOf(ctv1().id)
    const { user } = renderApp('/', { as: 'ctv1@demo.vn' })

    const bell = await screen.findByRole('button', { name: `Thông báo, ${unread} chưa đọc` })
    await user.click(bell)

    const list = within(await screen.findByRole('list', { name: 'Danh sách thông báo' }))
    const latest = db.notifications
      .filter((n) => n.userId === ctv1().id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!
    expect(list.getAllByRole('button')[0]).toHaveTextContent(latest.title)
  })

  it('opens the lead of a notification and marks it read', async () => {
    const target = db.notifications
      .filter((n) => n.userId === ctv1().id && n.readAt === null && n.data.leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!
    const { user, router } = renderApp('/', { as: 'ctv1@demo.vn' })

    await user.click(await screen.findByRole('button', { name: /^Thông báo/ }))
    const list = within(await screen.findByRole('list', { name: 'Danh sách thông báo' }))
    await user.click(list.getByRole('button', { name: new RegExp(target.title) }))

    expect(router.state.location.pathname).toBe(`/leads/${target.data.leadId}`)
    expect(db.notifications.find((n) => n.id === target.id)?.readAt).not.toBeNull()
  })

  it('marks everything read from the panel', async () => {
    const { user } = renderApp('/', { as: 'ctv1@demo.vn' })

    await user.click(await screen.findByRole('button', { name: /chưa đọc/ }))
    await user.click(await screen.findByRole('button', { name: 'Đánh dấu đã đọc' }))

    expect(await screen.findByRole('button', { name: 'Thông báo' })).toBeVisible()
    expect(unreadOf(ctv1().id)).toBe(0)
  })

  it('filters unread notifications on the notifications page', async () => {
    const { user, router } = renderApp('/notifications', { as: 'ctv1@demo.vn' })
    await screen.findByRole('list', { name: 'Danh sách thông báo' })

    await user.click(screen.getByRole('button', { name: 'Chưa đọc' }))

    const unread = unreadOf(ctv1().id)
    const list = within(await screen.findByRole('list', { name: 'Danh sách thông báo' }))
    expect(await list.findAllByText('(chưa đọc)')).toHaveLength(Math.min(unread, 20))
    expect(router.state.location.search).toBe('?unread=true')
  })
})

describe('Realtime', () => {
  it('pushes a staff status change to the affiliate: toast, bell and the open lead page', async () => {
    const lead = db.leads.find((l) => l.affiliateId === ctv1().id && l.status === 'NEW')!
    const unread = unreadOf(ctv1().id)
    renderApp(`/leads/${lead.id}`, { as: 'ctv1@demo.vn' })
    await screen.findByRole('heading', { name: lead.customerName })
    await screen.findByRole('button', { name: `Thông báo, ${unread} chưa đọc` })

    await asStaff(`/leads/${lead.id}/status`, { status: 'CONTACTED' })

    expect(await screen.findByText(`Lead ${lead.code}: Đã liên hệ`)).toBeVisible()
    expect(
      await screen.findByRole('button', { name: `Thông báo, ${unread + 1} chưa đọc` }),
    ).toBeVisible()
    // lead:updated refetched the page: the badge next to the name shows the new status.
    const heading = screen.getByRole('heading', { name: lead.customerName })
    expect(await within(heading.parentElement!).findByText('Đã liên hệ')).toBeVisible()
  })

  it('moves a card on a colleague’s kanban without a reload', async () => {
    const lead = db.leads.find((l) => l.status === 'NEW')!
    renderApp('/leads', { as: 'admin@demo.vn' })
    const newColumn = await screen.findByRole('region', { name: 'Cột Mới' })
    await within(newColumn).findByRole('button', { name: new RegExp(lead.code) })

    await asStaff(`/leads/${lead.id}/status`, { status: 'CONTACTED' })

    const contacted = screen.getByRole('region', { name: 'Cột Đã liên hệ' })
    expect(
      await within(contacted).findByRole('button', { name: new RegExp(lead.code) }),
    ).toBeVisible()
    expect(within(newColumn).queryByRole('button', { name: new RegExp(lead.code) })).toBeNull()
  })
})
