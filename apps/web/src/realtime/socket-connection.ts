import { io, type Socket } from 'socket.io-client'
import { refreshAccessToken } from '@/api/client'
import { tokenStore } from '@/api/token-store'
import type { ServerToClientEvents } from '@/api/types'
import { config } from '@/config'
import type { RealtimeConnection } from './types'

const MAX_REFUSED_ATTEMPTS = 5

/**
 * Socket.IO connection to the API (namespace `/realtime`, contract "Realtime").
 *
 * - The access token goes in the handshake `auth`, read fresh on every (re)connect.
 * - The server disconnects the socket when the token expires (`io server disconnect`) and does
 *   not reconnect by itself: we get a valid token (refreshing if needed) and connect again.
 * - A refused handshake (`connect_error` with `socket.active === false`, e.g. an expired token)
 *   forces a refresh, then retries with backoff. Network errors are retried by Socket.IO itself.
 */
export function connectSocket(): RealtimeConnection {
  const socket: Socket<ServerToClientEvents> = io(`${config.socketUrl}/realtime`, {
    path: '/socket.io',
    autoConnect: false,
    auth: (send) => send({ token: tokenStore.getAccessToken() ?? '' }),
  })
  let closed = false
  let refusedAttempts = 0
  let retryTimer: ReturnType<typeof setTimeout> | undefined

  async function connect({ forceRefresh = false } = {}) {
    if (closed) return
    let token = forceRefresh ? null : tokenStore.getAccessToken()
    if (!token) token = await refreshAccessToken().catch(() => null)
    // No token: the session is over and the app is logging out; it will close us.
    if (token && !closed) socket.connect()
  }

  socket.on('connect', () => {
    refusedAttempts = 0
  })

  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') void connect()
  })

  socket.on('connect_error', () => {
    if (socket.active || closed) return // temporary failure: Socket.IO retries on its own
    refusedAttempts += 1
    if (refusedAttempts > MAX_REFUSED_ATTEMPTS) return
    const delay = Math.min(30_000, 1000 * 2 ** (refusedAttempts - 1))
    retryTimer = setTimeout(() => void connect({ forceRefresh: true }), delay)
  })

  void connect()

  return {
    on(event, handler) {
      // Socket.IO's typed `on` cannot narrow a generic event name; the cast stays local.
      socket.on(event, handler as never)
      return () => {
        socket.off(event, handler as never)
      }
    },
    close() {
      closed = true
      clearTimeout(retryTimer)
      socket.removeAllListeners()
      socket.disconnect()
    },
  }
}
