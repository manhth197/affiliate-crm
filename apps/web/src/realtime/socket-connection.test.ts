import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** A stand-in for socket.io-client's Socket: records calls, lets the test fire events. */
class FakeSocket {
  active = true
  connectCalls = 0
  disconnected = false
  auth: (send: (data: object) => void) => void = () => {}
  private handlers = new Map<string, Set<(...args: unknown[]) => void>>()

  on(event: string, handler: (...args: unknown[]) => void) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
    return this
  }
  off(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.get(event)?.delete(handler)
    return this
  }
  removeAllListeners() {
    this.handlers.clear()
    return this
  }
  connect() {
    this.connectCalls++
    return this
  }
  disconnect() {
    this.disconnected = true
    return this
  }
  fire(event: string, ...args: unknown[]) {
    this.handlers.get(event)?.forEach((handler) => handler(...args))
  }
  /** The token the handshake would send right now. */
  handshakeToken() {
    let token = ''
    this.auth((data) => (token = (data as { token: string }).token))
    return token
  }
}

let socket: FakeSocket
let ioArgs: unknown[] = []
vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => {
    ioArgs = args
    socket = new FakeSocket()
    socket.auth = (args[1] as { auth: FakeSocket['auth'] }).auth
    return socket
  },
}))

const refresh = vi.fn<() => Promise<string | null>>()
vi.mock('@/api/client', () => ({ refreshAccessToken: () => refresh() }))

const { tokenStore } = await import('@/api/token-store')
const { connectSocket } = await import('./socket-connection')

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('connectSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'], shouldAdvanceTime: true })
    refresh.mockReset()
    tokenStore.setTokens({ accessToken: 'token-1', refreshToken: 'r1', expiresIn: 900 })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('connects to the /realtime namespace with the current access token', async () => {
    connectSocket()
    await flush()

    expect(ioArgs[0]).toBe('http://localhost:3000/realtime')
    expect(ioArgs[1]).toMatchObject({ path: '/socket.io', autoConnect: false })
    expect(socket.connectCalls).toBe(1)
    expect(socket.handshakeToken()).toBe('token-1')
  })

  it('refreshes the token and reconnects when the server drops an expired socket', async () => {
    connectSocket()
    await flush()
    // The token ran out: the store no longer hands it out, the server disconnects us.
    tokenStore.setTokens({ accessToken: 'token-1', refreshToken: 'r1', expiresIn: 0 })
    refresh.mockImplementation(async () => {
      tokenStore.setTokens({ accessToken: 'token-2', refreshToken: 'r2', expiresIn: 900 })
      return 'token-2'
    })

    socket.active = false
    socket.fire('disconnect', 'io server disconnect')
    await flush()

    expect(refresh).toHaveBeenCalledOnce()
    expect(socket.connectCalls).toBe(2)
    expect(socket.handshakeToken()).toBe('token-2')
  })

  it('does not reconnect by hand after a normal network drop (Socket.IO retries itself)', async () => {
    connectSocket()
    await flush()

    socket.fire('disconnect', 'transport close')
    await flush()

    expect(refresh).not.toHaveBeenCalled()
    expect(socket.connectCalls).toBe(1)
  })

  it('forces a refresh and retries with backoff when the handshake is refused', async () => {
    connectSocket()
    await flush()
    refresh.mockResolvedValue('token-3')

    socket.active = false // refused by the server's auth middleware
    socket.fire('connect_error', new Error('invalid token'))
    expect(refresh).not.toHaveBeenCalled() // waits 1 s first

    await vi.advanceTimersByTimeAsync(1000)
    expect(refresh).toHaveBeenCalledOnce()
    expect(socket.connectCalls).toBe(2)
  })

  it('stops when the session is over (refresh returns null)', async () => {
    tokenStore.clear()
    refresh.mockResolvedValue(null)

    connectSocket()
    await flush()

    expect(socket.connectCalls).toBe(0)
  })

  it('closes cleanly and ignores late events', async () => {
    const connection = connectSocket()
    await flush()

    connection.close()
    socket.fire('disconnect', 'io server disconnect')
    await flush()

    expect(socket.disconnected).toBe(true)
    expect(socket.connectCalls).toBe(1)
  })
})
