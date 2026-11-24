import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests against a running stack (real API + this web app): the integration
 * walk-through from M4/M5 as repeatable specs.
 *
 *   E2E_BASE_URL   the web app (default http://localhost:5173: `npm run dev`; the Docker image
 *                  serves on http://localhost:8080)
 *   E2E_API_URL    the API, checked before the run (default <E2E_BASE_URL origin>:3000 for the
 *                  dev server, or the same origin behind nginx)
 *   E2E_CHANNEL    an installed browser: msedge (default) or chrome. We never download browsers.
 *
 * Every run registers a new affiliate, so the specs can run again and again on the same data.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  globalSetup: './global-setup.ts',
  // The flows build on each other and share the database: run them one after another.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: '../test-results',
  use: {
    baseURL,
    channel: process.env.E2E_CHANNEL ?? 'msedge',
    headless: true,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    viewport: { width: 1366, height: 860 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
