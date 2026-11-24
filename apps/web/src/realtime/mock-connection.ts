import type { Me, ServerToClientEvents } from '@/api/types'
import { mockRealtime, type RealtimeEvent } from '@/mocks/realtime'
import type { RealtimeConnection } from './types'

type AnyHandler = (payload: unknown) => void

/** Mock mode and tests: join the same rooms the API would (`user:<id>`, `role:<ROLE>`). */
export function connectMock(user: Pick<Me, 'id' | 'role'>): RealtimeConnection {
  const handlers = new Map<RealtimeEvent, Set<AnyHandler>>()
  const leave = mockRealtime.join([`user:${user.id}`, `role:${user.role}`], (event, payload) => {
    handlers.get(event)?.forEach((handler) => handler(payload))
  })

  return {
    on<E extends RealtimeEvent>(event: E, handler: ServerToClientEvents[E]) {
      const set = handlers.get(event) ?? new Set<AnyHandler>()
      handlers.set(event, set)
      set.add(handler as AnyHandler)
      return () => {
        set.delete(handler as AnyHandler)
      }
    },
    close() {
      handlers.clear()
      leave()
    },
  }
}
