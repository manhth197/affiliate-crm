import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { delay, http } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { leadsApi } from '@/api/leads'
import type { Lead, LeadQuery, Paginated } from '@/api/types'
import { createQueryClient } from '@/lib/query-client'
import { db } from '@/mocks/db'
import { api, businessError } from '@/mocks/http'
import { server } from '@/mocks/node'
import { signInAs } from '@/test/render'
import { leadKeys, useChangeLeadStatus } from './queries'

const newColumn: LeadQuery = { status: 'NEW', page: 1, pageSize: 100 }
const contactedColumn: LeadQuery = { status: 'CONTACTED', page: 1, pageSize: 100 }

/** A query client with two kanban columns cached (no observers, so nothing refetches). */
async function setup() {
  signInAs('staff@demo.vn')
  const queryClient = createQueryClient({ forTests: true })
  for (const query of [newColumn, contactedColumn]) {
    queryClient.setQueryData(leadKeys.list(query), await leadsApi.list(query))
  }
  const lead = queryClient.getQueryData<Paginated<Lead>>(leadKeys.list(newColumn))!.data[0]!
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useChangeLeadStatus(), { wrapper })
  const column = (query: LeadQuery) =>
    queryClient.getQueryData<Paginated<Lead>>(leadKeys.list(query))!
  return { lead, result, column }
}

describe('useChangeLeadStatus', () => {
  it('moves the card between cached columns before the server answers', async () => {
    server.use(
      http.patch(api('/leads/:id/status'), async () => {
        await delay('infinite')
      }),
    )
    const { lead, result, column } = await setup()
    const before = {
      new: column(newColumn).meta.total,
      contacted: column(contactedColumn).meta.total,
    }

    act(() => result.current.mutate({ lead, body: { status: 'CONTACTED' } }))

    await waitFor(() => expect(column(contactedColumn).data[0]?.id).toBe(lead.id))
    expect(column(contactedColumn).data[0]?.status).toBe('CONTACTED')
    expect(column(contactedColumn).meta.total).toBe(before.contacted + 1)
    expect(column(newColumn).data.some((l) => l.id === lead.id)).toBe(false)
    expect(column(newColumn).meta.total).toBe(before.new - 1)
  })

  it('puts the card back when the server refuses the change', async () => {
    server.use(
      http.patch(api('/leads/:id/status'), () =>
        businessError(409, 'INVALID_TRANSITION', 'Cannot move'),
      ),
    )
    const { lead, result, column } = await setup()
    const snapshot = { new: column(newColumn), contacted: column(contactedColumn) }

    act(() => result.current.mutate({ lead, body: { status: 'CONTACTED' } }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(column(newColumn)).toEqual(snapshot.new)
    expect(column(contactedColumn)).toEqual(snapshot.contacted)
    expect(db.leads.find((l) => l.id === lead.id)?.status).toBe('NEW')
  })
})
