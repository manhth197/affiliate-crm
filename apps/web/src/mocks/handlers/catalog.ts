import { http, HttpResponse } from 'msw'
import type { ProductCategory, StaffMember } from '@/api/types'
import { db } from '../db'
import { api, authenticate, latency } from '../http'
import { readQuery, withQueryErrors } from '../query'

const CATEGORIES = [
  'LOAN',
  'CREDIT_CARD',
  'INSURANCE',
] as const satisfies readonly ProductCategory[]

export const catalogHandlers = [
  http.get(api('/products'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error

    return withQueryErrors(() => {
      const query = readQuery(request)
      // Affiliates only ever see active products.
      const active = auth.user.role === 'AFFILIATE' ? true : query.boolean('active')
      const category = query.enum('category', CATEGORIES)
      const products = db.products.filter(
        (p) =>
          (active === undefined || p.active === active) && (!category || p.category === category),
      )
      return HttpResponse.json(products)
    })
  }),

  // Contract v0.2: people who can be assigned leads.
  http.get(api('/staff'), async ({ request }) => {
    await latency()
    const auth = authenticate(request, ['STAFF', 'ADMIN'])
    if (auth.error) return auth.error
    const staff: StaffMember[] = db.users
      .filter((u) => u.status === 'ACTIVE' && (u.role === 'STAFF' || u.role === 'ADMIN'))
      .map((u) => ({ id: u.id, fullName: u.fullName, role: u.role as StaffMember['role'] }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
    return HttpResponse.json(staff)
  }),
]
