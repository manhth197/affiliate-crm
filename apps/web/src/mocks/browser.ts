import { setupWorker } from 'msw/browser'
import { loadPersistedDb, persistDb } from './db'
import { handlers } from './handlers'

/** Start the Service Worker that answers API calls in the browser (mock mode). */
export async function startMockWorker() {
  loadPersistedDb()
  const worker = setupWorker(...handlers)

  // Keep mock data across reloads: save after every mocked write.
  worker.events.on('response:mocked', ({ request }) => {
    if (request.method !== 'GET') persistDb()
  })

  await worker.start({ onUnhandledFrame: 'bypass', quiet: true })
  console.info('[mock] API calls are answered by MSW (no backend).')
}
