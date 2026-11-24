import { http, HttpResponse } from 'msw'
import type { AuthResponse, LoginRequest, RegisterRequest, TokenPair, User } from '@/api/types'
import { toLocalPhone, VN_PHONE_REGEX } from '@/lib/validation'
import { db, findUserByEmail, findUserById, nextReferralCode, toMe } from '../db'
import { api, apiError, authenticate, latency, readJson } from '../http'
import { rejectUnknownProperties } from '../query'
import { issueTokens, revokeRefreshToken, rotateRefreshToken } from '../tokens'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const authHandlers = [
  http.post(api('/auth/register'), async ({ request }) => {
    await latency()
    const body = await readJson<RegisterRequest>(request)
    const unknown = rejectUnknownProperties(body, ['email', 'password', 'fullName', 'phone'])
    if (unknown) return unknown

    const email = body.email?.trim().toLowerCase() ?? ''
    const phone = typeof body.phone === 'string' ? toLocalPhone(body.phone) : ''
    const details: { field: string; message: string }[] = []
    if (!EMAIL_REGEX.test(email)) {
      details.push({ field: 'email', message: 'email must be an email' })
    }
    if (!body.password || body.password.length < 8) {
      details.push({ field: 'password', message: 'password must be at least 8 characters' })
    }
    if (!body.fullName?.trim()) {
      details.push({ field: 'fullName', message: 'fullName should not be empty' })
    }
    if (!VN_PHONE_REGEX.test(phone)) {
      details.push({ field: 'phone', message: 'must be a valid VN phone number' })
    }
    if (details.length > 0) return apiError(400, 'Validation failed', details)
    if (findUserByEmail(email)) return apiError(409, 'Email already registered')

    const user: User = {
      id: crypto.randomUUID(),
      email,
      fullName: body.fullName!.trim(),
      phone,
      role: 'AFFILIATE',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    }
    db.users.push(user)
    db.passwords[user.id] = body.password!
    db.affiliates.push({
      userId: user.id,
      referralCode: nextReferralCode(),
      bankName: null,
      bankAccountMasked: null,
    })

    return HttpResponse.json<AuthResponse>(
      { user: toMe(user), ...issueTokens(user.id) },
      { status: 201 },
    )
  }),

  http.post(api('/auth/login'), async ({ request }) => {
    await latency()
    const body = await readJson<LoginRequest>(request)
    const unknown = rejectUnknownProperties(body, ['email', 'password'])
    if (unknown) return unknown

    const user = body.email ? findUserByEmail(body.email) : undefined
    if (!user || db.passwords[user.id] !== body.password) {
      return apiError(401, 'Invalid email or password')
    }
    if (user.status !== 'ACTIVE') return apiError(403, 'Account is disabled')
    return HttpResponse.json<AuthResponse>({ user: toMe(user), ...issueTokens(user.id) })
  }),

  http.post(api('/auth/refresh'), async ({ request }) => {
    await latency()
    const body = await readJson<{ refreshToken: string }>(request)
    const unknown = rejectUnknownProperties(body, ['refreshToken'])
    if (unknown) return unknown

    const session = body.refreshToken ? db.sessions[body.refreshToken] : undefined
    if (session && findUserById(session.userId)?.status === 'DISABLED') {
      revokeRefreshToken(body.refreshToken!)
      return apiError(403, 'Account is disabled')
    }
    const tokens = body.refreshToken ? rotateRefreshToken(body.refreshToken) : null
    if (!tokens) return apiError(401, 'Invalid refresh token')
    return HttpResponse.json<TokenPair>(tokens)
  }),

  // Contract v0.2: always 204; an unknown or foreign token is ignored.
  http.post(api('/auth/logout'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    const { refreshToken } = await readJson<{ refreshToken: string }>(request)
    if (refreshToken && db.sessions[refreshToken]?.userId === auth.user.id) {
      revokeRefreshToken(refreshToken)
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api('/auth/me'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    return HttpResponse.json(toMe(auth.user))
  }),
]
