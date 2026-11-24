import type { ServerToClientEvents } from '@/api/types'

export type RealtimeEvent = keyof ServerToClientEvents
type Listener = (event: RealtimeEvent, payload: unknown) => void

/**
 * In-memory stand-in for the API's Socket.IO server, used in mock mode and in tests.
 * Like the real server, clients join rooms (`user:<id>`, `role:<ROLE>`) and the mock handlers
 * emit to rooms. A client in several target rooms gets each event once (like `io.to([...])`).
 */
const rooms = new Map<string, Set<Listener>>()

export const mockRealtime = {
  join(roomNames: readonly string[], listener: Listener): () => void {
    for (const room of roomNames) {
      if (!rooms.has(room)) rooms.set(room, new Set())
      rooms.get(room)!.add(listener)
    }
    return () => roomNames.forEach((room) => rooms.get(room)?.delete(listener))
  },

  emit<E extends RealtimeEvent>(
    to: string | readonly string[],
    event: E,
    payload: Parameters<ServerToClientEvents[E]>[0],
  ) {
    const targets = new Set<Listener>()
    for (const room of typeof to === 'string' ? [to] : to) {
      rooms.get(room)?.forEach((listener) => targets.add(listener))
    }
    // Async like a real socket: never inside the HTTP handler's call stack.
    targets.forEach((listener) => queueMicrotask(() => listener(event, payload)))
  },

  reset() {
    rooms.clear()
  },
}
