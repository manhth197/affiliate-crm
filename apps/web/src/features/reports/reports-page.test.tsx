import { screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { formatNumber, formatVnd } from '@/lib/format'
import { db } from '@/mocks/db'
import { renderApp } from '@/test/render'
import { asText } from '@/test/text'
import { presetDays, presetRange } from './report-range'

describe('report ranges (Vietnam calendar)', () => {
  const now = new Date('2026-11-24T03:00:00.000Z') // 10:00 in Vietnam

  it('turns presets into inclusive days and a half-open range', () => {
    expect(presetDays('7d', now)).toEqual({ first: '2026-11-18', last: '2026-11-24' })
    expect(presetDays('last-month', now)).toEqual({ first: '2026-10-01', last: '2026-10-31' })
    expect(presetRange('this-month', now)).toEqual({
      from: '2026-10-31T17:00:00.000Z',
      to: '2026-11-24T17:00:00.000Z',
    })
  })
})

describe('ReportsPage', () => {
  // The route loads the page lazily (Recharts); import it once so each test does not wait.
  beforeAll(async () => {
    await import('./reports-page')
  })

  it('shows the KPIs and top affiliates for the last 30 days', async () => {
    const { from, to } = presetRange('30d')
    const inRange = (iso: string) => iso >= from && iso < to
    const leads = db.leads.filter((l) => inRange(l.createdAt))
    const disbursed = leads.filter((l) => l.status === 'DISBURSED')
    renderApp('/reports', { as: 'staff@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Báo cáo' })).toBeVisible()
    expect(await screen.findByText(formatNumber(leads.length))).toBeVisible()
    expect(
      screen.getByText(
        asText(formatVnd(disbursed.reduce((sum, l) => sum + (l.disbursedAmount ?? 0), 0))),
      ),
    ).toBeVisible()
    const top = within(await screen.findByRole('table', { name: 'Cộng tác viên dẫn đầu' }))
    expect(top.getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('switches the range through the URL', async () => {
    const { user, router } = renderApp('/reports', { as: 'admin@demo.vn' })
    await screen.findByRole('heading', { name: 'Báo cáo' })

    await user.selectOptions(screen.getByLabelText('Khoảng thời gian'), '7d')

    expect(router.state.location.search).toBe('?range=7d')
  })

  it('is closed to affiliates', async () => {
    renderApp('/reports', { as: 'ctv1@demo.vn' })

    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible()
  })
})
