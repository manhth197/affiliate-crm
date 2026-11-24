import { http, HttpResponse } from 'msw'
import type { Product, Role, User, UserStatus } from '@/api/types'
import { toLocalPhone, VN_PHONE_REGEX } from '@/lib/validation'
import { db, findUserByEmail, findUserById } from '../db'
import { api, apiError, authenticate, businessError, latency, readJson } from '../http'
import { foldText, paginate, readQuery, rejectUnknownProperties, withQueryErrors } from '../query'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CATEGORIES = ['LOAN', 'CREDIT_CARD', 'INSURANCE'] as const
const COMMISSION_TYPES = ['PERCENT', 'FIXED'] as const
const PRODUCT_FIELDS = [
  'name',
  'partnerName',
  'category',
  'commissionType',
  'commissionValue',
  'active',
]

type Details = { field: string; message: string }[]

/** Validate a full (create) or partial (update) product body like the API's DTOs do. */
function validateProduct(body: Partial<Product>, partial: boolean): Details {
  const details: Details = []
  const has = (key: keyof Product) => body[key] !== undefined
  if (
    (!partial || has('name')) &&
    !(typeof body.name === 'string' && body.name.trim() && body.name.length <= 150)
  ) {
    details.push({ field: 'name', message: 'name must be 1–150 characters' })
  }
  if (
    (!partial || has('partnerName')) &&
    !(
      typeof body.partnerName === 'string' &&
      body.partnerName.trim() &&
      body.partnerName.length <= 100
    )
  ) {
    details.push({ field: 'partnerName', message: 'partnerName must be 1–100 characters' })
  }
  if ((!partial || has('category')) && !CATEGORIES.includes(body.category as never)) {
    details.push({ field: 'category', message: 'category must be a valid ProductCategory' })
  }
  if (
    (!partial || has('commissionType')) &&
    !COMMISSION_TYPES.includes(body.commissionType as never)
  ) {
    details.push({ field: 'commissionType', message: 'commissionType must be PERCENT or FIXED' })
  }
  if (!partial || has('commissionValue')) {
    const value = body.commissionValue
    const max = body.commissionType === 'PERCENT' ? 10_000 : 1_000_000_000
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
      details.push({ field: 'commissionValue', message: `commissionValue must be 0–${max}` })
    }
  }
  if (has('active') && typeof body.active !== 'boolean') {
    details.push({ field: 'active', message: 'active must be a boolean' })
  }
  return details
}

export const adminHandlers = [
  // ---- Products (ADMIN) ----
  http.post(api('/products'), async ({ request }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    const body = await readJson<Product>(request)
    const unknown = rejectUnknownProperties(body, PRODUCT_FIELDS)
    if (unknown) return unknown
    const details = validateProduct(body, false)
    if (details.length) return apiError(400, 'Validation failed', details)

    const product: Product = {
      id: crypto.randomUUID(),
      name: body.name!.trim(),
      partnerName: body.partnerName!.trim(),
      category: body.category!,
      commissionType: body.commissionType!,
      commissionValue: body.commissionValue!,
      active: body.active ?? true,
      createdAt: new Date().toISOString(),
    }
    db.products.push(product)
    return HttpResponse.json(product, { status: 201 })
  }),

  http.patch(api('/products/:id'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    const product = db.products.find((p) => p.id === params.id)
    if (!product) return apiError(404, 'Product not found')
    const body = await readJson<Product>(request)
    const unknown = rejectUnknownProperties(body, PRODUCT_FIELDS)
    if (unknown) return unknown
    // The value range depends on the type, which may come from the stored product.
    const details = validateProduct(
      { ...body, commissionType: body.commissionType ?? product.commissionType },
      true,
    )
    if (details.length) return apiError(400, 'Validation failed', details)

    Object.assign(product, {
      ...body,
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.partnerName !== undefined && { partnerName: body.partnerName.trim() }),
    })
    return HttpResponse.json(product)
  }),

  // ---- Users (ADMIN) ----
  http.get(api('/users'), async ({ request }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    return withQueryErrors(() => {
      const query = readQuery(request)
      const role = query.enum<Role>('role', ['ADMIN', 'STAFF', 'AFFILIATE'])
      const status = query.enum<UserStatus>('status', ['ACTIVE', 'DISABLED'])
      const search = query.string('q')
      const page = query.page()
      const needle = search ? foldText(search.trim()) : undefined
      const users = db.users
        .filter(
          (u) =>
            (!role || u.role === role) &&
            (!status || u.status === status) &&
            (!needle || foldText(u.fullName).includes(needle) || u.email.includes(needle)),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      return HttpResponse.json(paginate(users, page))
    })
  }),

  http.post(api('/users'), async ({ request }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    const body = await readJson<{
      email: string
      password: string
      fullName: string
      phone: string
      role: Role
    }>(request)
    const unknown = rejectUnknownProperties(body, [
      'email',
      'password',
      'fullName',
      'phone',
      'role',
    ])
    if (unknown) return unknown

    const email = body.email?.trim().toLowerCase() ?? ''
    const phone = typeof body.phone === 'string' ? toLocalPhone(body.phone) : ''
    const details: Details = []
    if (!EMAIL_REGEX.test(email))
      details.push({ field: 'email', message: 'email must be an email' })
    if (!body.password || body.password.length < 8) {
      details.push({ field: 'password', message: 'password must be at least 8 characters' })
    }
    if (!body.fullName?.trim())
      details.push({ field: 'fullName', message: 'fullName should not be empty' })
    if (!VN_PHONE_REGEX.test(phone))
      details.push({ field: 'phone', message: 'must be a valid VN phone number' })
    if (body.role !== 'STAFF' && body.role !== 'ADMIN') {
      details.push({ field: 'role', message: 'role must be STAFF or ADMIN' })
    }
    if (details.length) return apiError(400, 'Validation failed', details)
    if (findUserByEmail(email)) return businessError(409, 'EMAIL_TAKEN', 'Email already registered')

    const user: User = {
      id: crypto.randomUUID(),
      email,
      fullName: body.fullName!.trim(),
      phone,
      role: body.role!,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    }
    db.users.push(user)
    db.passwords[user.id] = body.password!
    return HttpResponse.json(user, { status: 201 })
  }),

  http.patch(api('/users/:id'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request, ['ADMIN'])
    if (auth.error) return auth.error
    const user = findUserById(String(params.id))
    if (!user) return apiError(404, 'User not found')
    const body = await readJson<{ status: UserStatus; fullName: string; phone: string }>(request)
    const unknown = rejectUnknownProperties(body, ['status', 'fullName', 'phone'])
    if (unknown) return unknown

    const details: Details = []
    if (body.status !== undefined && body.status !== 'ACTIVE' && body.status !== 'DISABLED') {
      details.push({ field: 'status', message: 'status must be ACTIVE or DISABLED' })
    }
    if (body.fullName !== undefined && !body.fullName.trim()) {
      details.push({ field: 'fullName', message: 'fullName should not be empty' })
    }
    const phone = body.phone !== undefined ? toLocalPhone(body.phone) : undefined
    if (phone !== undefined && !VN_PHONE_REGEX.test(phone)) {
      details.push({ field: 'phone', message: 'must be a valid VN phone number' })
    }
    if (details.length) return apiError(400, 'Validation failed', details)
    if (body.status === 'DISABLED' && user.id === auth.user.id) {
      return apiError(422, 'Admins cannot disable themselves')
    }

    if (body.status) user.status = body.status
    if (body.fullName !== undefined) user.fullName = body.fullName.trim()
    if (phone !== undefined) user.phone = phone
    // Disabling a user ends all of their sessions.
    if (body.status === 'DISABLED') {
      for (const [token, session] of Object.entries(db.sessions)) {
        if (session.userId === user.id) delete db.sessions[token]
      }
    }
    return HttpResponse.json(user)
  }),
]
