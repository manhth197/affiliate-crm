const env = import.meta.env

/**
 * Runtime configuration read from Vite env variables (see `.env.example`).
 * `VITE_API_URL` may be absolute or relative to the page (e.g. "/api/v1" behind a proxy).
 */
const apiUrl = (env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '')

export const config = {
  apiUrl,
  /** Socket.IO server; defaults to the API's origin (namespace `/realtime` is added). */
  socketUrl: (env.VITE_SOCKET_URL || new URL(apiUrl, globalThis.location?.origin).origin).replace(
    /\/+$/,
    '',
  ),
  /** `npm run dev:mock` / `build:mock` use the `mock` mode, which always turns mocks on. */
  useMocks: env.VITE_USE_MOCKS === 'true' || env.MODE === 'mock',
} as const
