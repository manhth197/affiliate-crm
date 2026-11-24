import type { Me, ServerToClientEvents } from '@/api/types'

export type RealtimeEventName = keyof ServerToClientEvents

/** What the app needs from a realtime connection, whatever carries it (Socket.IO or the mock). */
export type RealtimeConnection = {
  on<E extends RealtimeEventName>(event: E, handler: ServerToClientEvents[E]): () => void
  close(): void
}

/** Opens a connection for the logged-in user (the server puts it in its user and role rooms). */
export type ConnectRealtime = (user: Pick<Me, 'id' | 'role'>) => RealtimeConnection
