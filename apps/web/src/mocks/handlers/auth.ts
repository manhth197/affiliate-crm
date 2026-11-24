import { http, HttpResponse } from 'msw'
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  TokenPair,
  UpdateMeRequest,
  User,
} from '@/api/types'
import { toLocalPhone, VN_PHONE_REGEX } from '@/lib/validation'
import { db, findUserByEmail, findUserById, nextReferralCode, toMe } from '../db'
import { api, apiError, authenticate, businessError, latency, readJson } from '../http'
import { rejectUnknownProperties } from '../query'
import {
  clearRefreshCookie,
  issueTokens,
  publicTokens,
  readRefreshCookie,
  revokeRefreshToken,
  rotateRefreshToken,
  setRefreshCookie,
} from '../tokens'

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
    if (findUserByEmail(email)) return businessError(409, 'EMAIL_TAKEN', 'Email already registered')

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

    const tokens = issueTokens(user.id)
    return HttpResponse.json<AuthResponse>(
      { user: toMe(user), ...publicTokens(tokens) },
      { status: 201, headers: setRefreshCookie(request, tokens.refreshToken) },
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
    if (user.status !== 'ACTIVE') {
      return businessError(403, 'ACCOUNT_DISABLED', 'Account is disabled')
    }
    const tokens = issueTokens(user.id)
    return HttpResponse.json<AuthResponse>(
      { user: toMe(user), ...publicTokens(tokens) },
      { headers: setRefreshCookie(request, tokens.refreshToken) },
    )
  }),

  // Contract v0.7: the refresh token only travels in the httpOnly cookie; the body is `{}`.
  http.post(api('/auth/refresh'), async ({ request }) => {
    await latency()
    const isJson = request.headers.get('content-type')?.includes('application/json') ?? false
    if (!isJson) {
      // Must be JSON (forces a CORS preflight); the token is not consumed.
      return apiError(415, 'Content-Type must be application/json')
    }
    const unknown = rejectUnknownProperties(await readJson<Record<string, unknown>>(request), [])
    if (unknown) return unknown

    const token = readRefreshCookie(request)
    const session = token ? db.sessions[token] : undefined
    if (session && findUserById(session.userId)?.status === 'DISABLED') {
      revokeRefreshToken(token!)
      return businessError(403, 'ACCOUNT_DISABLED', 'Account is disabled', clearRefreshCookie())
    }
    const tokens = token ? rotateRefreshToken(token) : null
    if (!tokens) return apiError(401, 'Invalid refresh token', undefined, clearRefreshCookie())
    return HttpResponse.json<TokenPair>(publicTokens(tokens), {
      headers: setRefreshCookie(request, tokens.refreshToken),
    })
  }),

  // Always 204 (v0.2); the token comes from the cookie and the cookie is cleared (v0.7).
  http.post(api('/auth/logout'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    const unknown = rejectUnknownProperties(await readJson<Record<string, unknown>>(request), [])
    if (unknown) return unknown
    const refreshToken = readRefreshCookie(request)
    if (refreshToken && db.sessions[refreshToken]?.userId === auth.user.id) {
      revokeRefreshToken(refreshToken)
    }
    // Logout always clears the cookie.
    return new HttpResponse(null, { status: 204, headers: clearRefreshCookie() })
  }),

  http.get(api('/auth/me'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    return HttpResponse.json(toMe(auth.user))
  }),

  // Contract v0.4 (planned M4): own profile; bank fields for affiliates only.
  http.patch(api('/auth/me'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    const body = await readJson<UpdateMeRequest>(request)
    const unknown = rejectUnknownProperties(body, [
      'fullName',
      'phone',
      'bankName',
      'bankAccountNumber',
    ])
    if (unknown) return unknown
    const touchesBank = body.bankName !== undefined || body.bankAccountNumber !== undefined
    if (touchesBank && auth.user.role !== 'AFFILIATE') {
      return apiError(403, 'Only affiliates have bank details')
    }

    const phone = body.phone !== undefined ? toLocalPhone(body.phone) : undefined
    // Contract v0.5: spaces in the account number are ignored.
    const account = body.bankAccountNumber?.replace(/\s/g, '')
    const details: { field: string; message: string }[] = []
    if (body.fullName !== undefined && !body.fullName.trim()) {
      details.push({ field: 'fullName', message: 'fullName should not be empty' })
    }
    if (phone !== undefined && !VN_PHONE_REGEX.test(phone)) {
      details.push({ field: 'phone', message: 'must be a valid VN phone number' })
    }
    if (body.bankName !== undefined && !(body.bankName.trim() && body.bankName.length <= 100)) {
      details.push({ field: 'bankName', message: 'bankName must be 1–100 characters' })
    }
    if (account !== undefined && !/^\d{6,20}$/.test(account)) {
      details.push({ field: 'bankAccountNumber', message: 'bankAccountNumber must be 6–20 digits' })
    }
    if (details.length) return apiError(400, 'Validation failed', details)

    const user = auth.user
    if (body.fullName !== undefined) user.fullName = body.fullName.trim()
    if (phone !== undefined) user.phone = phone
    const profile = db.affiliates.find((a) => a.userId === user.id)
    if (profile && body.bankName !== undefined) profile.bankName = body.bankName.trim()
    if (profile && account !== undefined) {
      // Only the last 4 digits are ever returned.
      profile.bankAccountMasked = `${'*'.repeat(account.length - 4)}${account.slice(-4)}`
    }
    return HttpResponse.json(toMe(user))
  }),
]
