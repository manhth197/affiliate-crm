import { http, HttpResponse } from 'msw'
import type { AuthResponse, LoginRequest, RegisterRequest, TokenPair, User } from '@/api/types'
import { VN_PHONE_REGEX } from '@/lib/validation'
import { db, findUserByEmail, nextReferralCode, toMe } from '../db'
import { api, apiError, authenticate, latency, readJson } from '../http'
import { issueTokens, revokeRefreshToken, rotateRefreshToken } from '../tokens'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const authHandlers = [
  http.post(api('/auth/register'), async ({ request }) => {
    await latency()
    const body = await readJson<RegisterRequest>(request)

    const details: { field: string; message: string }[] = []
    if (!body.email || !EMAIL_REGEX.test(body.email)) {
      details.push({ field: 'email', message: 'email must be an email' })
    }
    if (!body.password || body.password.length < 8) {
      details.push({ field: 'password', message: 'password must be at least 8 characters' })
    }
    if (!body.fullName?.trim()) {
      details.push({ field: 'fullName', message: 'fullName should not be empty' })
    }
    if (!body.phone || !VN_PHONE_REGEX.test(body.phone)) {
      details.push({ field: 'phone', message: 'must be a valid VN phone number' })
    }
    if (details.length > 0) return apiError(400, 'Validation failed', details)
    if (findUserByEmail(body.email!)) return apiError(409, 'Email already registered')

    const user: User = {
      id: crypto.randomUUID(),
      email: body.email!.trim().toLowerCase(),
      fullName: body.fullName!.trim(),
      phone: body.phone!,
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
    const user = body.email ? findUserByEmail(body.email) : undefined
    if (!user || db.passwords[user.id] !== body.password) {
      return apiError(401, 'Invalid email or password')
    }
    if (user.status !== 'ACTIVE') return apiError(403, 'Account is disabled')
    return HttpResponse.json<AuthResponse>({ user: toMe(user), ...issueTokens(user.id) })
  }),

  http.post(api('/auth/refresh'), async ({ request }) => {
    await latency()
    const { refreshToken } = await readJson<{ refreshToken: string }>(request)
    const tokens = refreshToken ? rotateRefreshToken(refreshToken) : null
    if (!tokens) return apiError(401, 'Invalid refresh token')
    return HttpResponse.json<TokenPair>(tokens)
  }),

  http.post(api('/auth/logout'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    const { refreshToken } = await readJson<{ refreshToken: string }>(request)
    if (refreshToken) revokeRefreshToken(refreshToken)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(api('/auth/me'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    return HttpResponse.json(toMe(auth.user))
  }),
]
