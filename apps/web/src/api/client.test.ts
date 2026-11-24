import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { db, findUserByEmail } from '@/mocks/db'
import { api, authenticate } from '@/mocks/http'
import { server } from '@/mocks/node'
import { issueTokens } from '@/mocks/tokens'
import { apiRequest, onSessionExpired } from './client'
import { ApiError } from './errors'
import { tokenStore } from './token-store'

/** Protected test endpoint that answers with the caller's id. */
function useWhoAmIEndpoint() {
  server.use(
    http.get(api('/test/whoami'), ({ request }) => {
      const auth = authenticate(request)
      if (auth.error) return auth.error
      return HttpResponse.json({ userId: auth.user.id })
    }),
  )
}

/** Count calls to /auth/refresh while letting the real mock handler answer. */
function countRefreshCalls() {
  const counter = { calls: 0 }
  server.events.on('request:start', ({ request }) => {
    if (request.url.endsWith('/auth/refresh')) counter.calls++
  })
  return counter
}

function startSession(accessToken?: string) {
  const user = findUserByEmail('ctv1@demo.vn')!
  const tokens = issueTokens(user.id)
  tokenStore.setTokens({ ...tokens, accessToken: accessToken ?? tokens.accessToken })
  return { user, tokens }
}

describe('apiRequest', () => {
  it('sends the bearer token and parses JSON', async () => {
    useWhoAmIEndpoint()
    const { user } = startSession()

    await expect(apiRequest('/test/whoami')).resolves.toEqual({ userId: user.id })
  })

  it('refreshes once on 401 and retries the request with the new token', async () => {
    useWhoAmIEndpoint()
    const { user, tokens } = startSession('expired-token')
    const refresh = countRefreshCalls()

    await expect(apiRequest('/test/whoami')).resolves.toEqual({ userId: user.id })
    expect(refresh.calls).toBe(1)
    // The refresh token was rotated: the old one is no longer valid.
    expect(tokenStore.getRefreshToken()).not.toBe(tokens.refreshToken)
    expect(db.sessions[tokens.refreshToken]).toBeUndefined()
  })

  it('shares a single refresh between concurrent 401 responses', async () => {
    useWhoAmIEndpoint()
    startSession('expired-token')
    const refresh = countRefreshCalls()

    const results = await Promise.all([
      apiRequest('/test/whoami'),
      apiRequest('/test/whoami'),
      apiRequest('/test/whoami'),
    ])

    expect(results).toHaveLength(3)
    expect(refresh.calls).toBe(1)
  })

  it('gets an access token first after a page reload (refresh token only)', async () => {
    useWhoAmIEndpoint()
    const { user, tokens } = startSession()
    tokenStore.clear()
    localStorage.setItem('affiliate-crm.refreshToken', tokens.refreshToken)

    await expect(apiRequest('/test/whoami')).resolves.toEqual({ userId: user.id })
    expect(tokenStore.getAccessToken()).not.toBeNull()
  })

  it('ends the session when the refresh token is rejected', async () => {
    useWhoAmIEndpoint()
    const { tokens } = startSession('expired-token')
    delete db.sessions[tokens.refreshToken] // e.g. revoked on another device
    const expired = vi.fn()
    const unsubscribe = onSessionExpired(expired)

    const error = await apiRequest('/test/whoami').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect(tokenStore.hasSession()).toBe(false)
    expect(expired).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('turns error bodies into ApiError with status and field details', async () => {
    server.use(
      http.post(api('/test/validate'), () =>
        HttpResponse.json(
          {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Validation failed',
            details: [{ field: 'customerPhone', message: 'must be a valid VN phone number' }],
          },
          { status: 400 },
        ),
      ),
    )

    const error = (await apiRequest('/test/validate', {
      method: 'POST',
      body: {},
      auth: false,
    }).catch((e: unknown) => e)) as ApiError

    expect(error.status).toBe(400)
    expect(error.details).toEqual([
      { field: 'customerPhone', message: 'must be a valid VN phone number' },
    ])
  })

  it('reports network failures as status 0', async () => {
    server.use(http.get(api('/test/offline'), () => HttpResponse.error()))

    const error = (await apiRequest('/test/offline', { auth: false }).catch(
      (e: unknown) => e,
    )) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
  })

  it('drops empty query values when building the URL', async () => {
    let url = ''
    server.use(
      http.get(api('/test/query'), ({ request }) => {
        url = request.url
        return HttpResponse.json({})
      }),
    )

    await apiRequest('/test/query', {
      auth: false,
      query: { status: 'NEW', q: '', page: 2, productId: undefined },
    })

    expect(new URL(url).search).toBe('?status=NEW&page=2')
  })
})
