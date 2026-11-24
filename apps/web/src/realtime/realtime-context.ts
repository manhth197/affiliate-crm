import { createContext, useContext } from 'react'
import { config } from '@/config'
import { connectMock } from './mock-connection'
import { connectSocket } from './socket-connection'
import type { ConnectRealtime } from './types'

/** Socket.IO against the real API, the in-memory bus in mock mode. Tests inject the mock. */
export const defaultConnectRealtime: ConnectRealtime = config.useMocks ? connectMock : connectSocket

export const RealtimeContext = createContext<ConnectRealtime>(defaultConnectRealtime)

export function useConnectRealtime() {
  return useContext(RealtimeContext)
}
