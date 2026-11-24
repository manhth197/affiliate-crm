const env = import.meta.env

/** Runtime configuration read from Vite env variables (see `.env.example`). */
export const config = {
  apiUrl: (env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, ''),
  /** `npm run dev:mock` / `build:mock` use the `mock` mode, which always turns mocks on. */
  useMocks: env.VITE_USE_MOCKS === 'true' || env.MODE === 'mock',
} as const
