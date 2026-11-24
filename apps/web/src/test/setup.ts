import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { toast } from 'sonner'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { tokenStore } from '@/api/token-store'
import { resetDb } from '@/mocks/db'
import { server } from '@/mocks/node'
import { mockRealtime } from '@/mocks/realtime'

// ---- jsdom gaps that Radix UI / sonner rely on ----
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}

// ---- Mock API: every test starts with a fresh seed and no session ----
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  cleanup()
  // sonner keeps toasts in a module-level store; without this they leak into the next test.
  toast.dismiss()
  server.resetHandlers()
  server.events.removeAllListeners()
  tokenStore.clear()
  localStorage.clear()
  resetDb()
  mockRealtime.reset()
})
afterAll(() => server.close())
