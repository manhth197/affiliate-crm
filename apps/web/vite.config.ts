import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { msw } from 'msw/vite'
import { defineConfig, loadEnv } from 'vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Same rule as src/config.ts: `--mode mock` or VITE_USE_MOCKS=true.
  const useMocks = mode === 'mock' || env.VITE_USE_MOCKS === 'true'

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Serve (and, for mock builds, emit) mockServiceWorker.js only when mocks are on,
      // so a real production build never ships the worker script.
      ...(useMocks ? [msw({ mode: 'worker-only' })] : []),
    ],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    server: { port: 5173, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // Playwright specs (e2e/) need a running stack; `npm run e2e` runs them.
      exclude: [...configDefaults.exclude, 'e2e/**'],
      restoreMocks: true,
    },
  }
})
