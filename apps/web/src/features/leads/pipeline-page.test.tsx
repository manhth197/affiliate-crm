import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LEAD_STATUSES } from '@/api/types'
import { LEAD_STATUS_LABELS } from '@/lib/labels'
import { db, findUserByEmail } from '@/mocks/db'
import { renderApp } from '@/test/render'

async function column(status: (typeof LEAD_STATUSES)[number]) {
  return within(await screen.findByRole('region', { name: `Cột ${LEAD_STATUS_LABELS[status]}` }))
}

describe('PipelinePage (kanban)', () => {
  it('shows one column per status with the right counts', async () => {
    renderApp('/leads', { as: 'staff@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Pipeline' })).toBeVisible()
    for (const status of LEAD_STATUSES) {
      const count = db.leads.filter((l) => l.status === status).length
      expect(await (await column(status)).findByLabelText(`${count} lead`)).toBeVisible()
    }
  })

  it('lists open leads with a drag handle, longest-waiting first', async () => {
    renderApp('/leads', { as: 'staff@demo.vn' })

    const newLeads = db.leads
      .filter((l) => l.status === 'NEW')
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    const col = await column('NEW')
    const handles = await col.findAllByRole('button', { name: /^Kéo / })
    expect(handles).toHaveLength(newLeads.length)
    expect(handles[0]).toHaveAccessibleName(
      `Kéo ${newLeads[0]!.code} ${newLeads[0]!.customerName} sang cột khác`,
    )
  })

  it('shows only recent closed leads and links to the full list', async () => {
    renderApp('/leads', { as: 'staff@demo.vn' })

    const disbursed = db.leads.filter((l) => l.status === 'DISBURSED').length
    const col = await column('DISBURSED')
    expect(await col.findAllByRole('button', { name: /^Kéo / })).toHaveLength(20)
    expect(col.getByRole('link', { name: `Xem tất cả ${disbursed} lead` })).toHaveAttribute(
      'href',
      '/leads?view=table&status=DISBURSED',
    )
  })

  it('filters the board by assignee ("Chưa giao" = unassigned)', async () => {
    const { user, router } = renderApp('/leads', { as: 'staff@demo.vn' })
    await column('NEW')

    await user.selectOptions(screen.getByLabelText('Phụ trách'), 'none')

    const unassignedNew = db.leads.filter(
      (l) => l.status === 'NEW' && l.assignedStaffId === null,
    ).length
    expect(await (await column('NEW')).findByLabelText(`${unassignedNew} lead`)).toBeVisible()
    expect(router.state.location.search).toBe('?assignee=none')
    // Columns already split by status, so the status filter is hidden on the board.
    expect(screen.queryByLabelText('Trạng thái')).not.toBeInTheDocument()
  })

  it('filters "Của tôi" to the current user', async () => {
    const { user } = renderApp('/leads', { as: 'staff@demo.vn' })
    await column('CONTACTED')
    const me = findUserByEmail('staff@demo.vn')!

    await user.selectOptions(screen.getByLabelText('Phụ trách'), 'me')

    const mine = db.leads.filter(
      (l) => l.status === 'CONTACTED' && l.assignedStaffId === me.id,
    ).length
    expect(await (await column('CONTACTED')).findByLabelText(`${mine} lead`)).toBeVisible()
  })

  it('switches between kanban and table and keeps it in the URL', async () => {
    const { user, router } = renderApp('/leads', { as: 'admin@demo.vn' })
    await column('NEW')

    await user.click(screen.getByRole('button', { name: 'Bảng' }))

    expect(await screen.findByRole('table')).toBeVisible()
    expect(router.state.location.search).toBe('?view=table')
    expect(screen.getByRole('button', { name: 'Bảng' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Kanban' }))
    expect(await screen.findByRole('region', { name: 'Cột Mới' })).toBeVisible()
    expect(router.state.location.search).toBe('')
  })
})
