import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

async function enableMocking() {
  // Written inline (not via config.ts) so Vite can drop the mock code from real builds.
  if (import.meta.env.VITE_USE_MOCKS !== 'true' && import.meta.env.MODE !== 'mock') return
  const { startMockWorker } = await import('./mocks/browser')
  await startMockWorker()
}

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
