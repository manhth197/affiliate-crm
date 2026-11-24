/** Fail fast with a clear message when the stack is not running. */
export default async function globalSetup() {
  const web = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
  const api =
    process.env.E2E_API_URL ??
    (new URL(web).port === '5173'
      ? 'http://localhost:3000/api/v1'
      : `${new URL(web).origin}/api/v1`)

  for (const [name, url] of [
    ['web', web],
    ['API', `${api}/health`],
  ] as const) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      throw new Error(
        `E2E: the ${name} is not reachable at ${url} (${String(error)}). ` +
          'Start the stack first (API on :3000 and `npm run dev`, or the Docker images).',
        { cause: error },
      )
    }
  }
}
