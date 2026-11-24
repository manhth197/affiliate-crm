import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, findUserByEmail } from '@/mocks/db'
import { renderApp } from '@/test/render'

/** A lead of ctv1 that has an internal NOTE in its timeline. */
function ctv1LeadWithNote() {
  const me = findUserByEmail('ctv1@demo.vn')!
  const lead = db.leads.find(
    (l) =>
      l.affiliateId === me.id && db.activities.some((a) => a.leadId === l.id && a.type === 'NOTE'),
  )!
  return lead
}

describe('LeadDetailPage', () => {
  it('shows the owner the lead with masked PII and a timeline without internal notes', async () => {
    const lead = ctv1LeadWithNote()
    renderApp(`/leads/${lead.id}`, { as: 'ctv1@demo.vn' })

    expect(await screen.findByRole('heading', { name: lead.customerName })).toBeVisible()
    expect(screen.getByText(/^\d{2}\*{6}\d{2}$/)).toBeVisible()
    const timeline = within(await screen.findByRole('list', { name: 'Lịch sử xử lý' }))
    expect(timeline.getByText('Tạo lead')).toBeVisible()
    expect(timeline.queryByText('Ghi chú nội bộ')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Tiến trình hồ sơ' })).toBeVisible()
  })

  it('shows staff the full phone number and internal notes', async () => {
    const lead = ctv1LeadWithNote()
    renderApp(`/leads/${lead.id}`, { as: 'staff@demo.vn' })

    expect(await screen.findByText(lead.customerPhone)).toBeVisible()
    const timeline = within(await screen.findByRole('list', { name: 'Lịch sử xử lý' }))
    expect(timeline.getByText('Ghi chú nội bộ')).toBeVisible()
    expect(timeline.getByText(/^Phân công cho /)).toBeVisible()
  })

  it("forbids an affiliate from opening another affiliate's lead", async () => {
    const ctv2 = findUserByEmail('ctv2@demo.vn')!
    const foreign = db.leads.find((l) => l.affiliateId === ctv2.id)!
    renderApp(`/leads/${foreign.id}`, { as: 'ctv1@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
    expect(screen.queryByText(foreign.customerName)).not.toBeInTheDocument()
  })

  it('shows not found for an unknown lead', async () => {
    renderApp('/leads/00000000-0000-4000-9999-000000000000', { as: 'ctv1@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible()
  })

  it('marks where a rejected lead stopped', async () => {
    const me = findUserByEmail('ctv1@demo.vn')!
    const rejected = db.leads.find((l) => l.affiliateId === me.id && l.status === 'REJECTED')!
    renderApp(`/leads/${rejected.id}`, { as: 'ctv1@demo.vn' })

    const stepper = within(await screen.findByRole('list', { name: 'Tiến trình hồ sơ' }))
    expect(stepper.getByText('Từ chối')).toBeVisible()
  })
})
