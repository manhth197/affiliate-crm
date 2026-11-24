/**
 * Environment for e2e tests. Always overrides DATABASE_URL so the tests can
 * never truncate the development database by accident.
 * Override with TEST_DATABASE_URL / TEST_REDIS_URL (e.g. in CI).
 */
const DEFAULT_TEST_DATABASE_URL =
  'postgresql://crm:crm@localhost:5433/affiliate_crm_test';
const DEFAULT_TEST_REDIS_URL = 'redis://localhost:6380/1';

export function applyTestEnv(): void {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run e2e tests against "${databaseName}": the database name must end with _test`,
    );
  }
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    REDIS_URL: process.env.TEST_REDIS_URL ?? DEFAULT_TEST_REDIS_URL,
    JWT_ACCESS_SECRET: 'e2e-test-secret-e2e-test-secret-e2e-test-secret',
    JWT_ACCESS_TTL_SECONDS: '900',
    REFRESH_TOKEN_TTL_DAYS: '7',
    // High limit so the suite is not throttled; auth-throttle.e2e-spec.ts lowers it.
    AUTH_THROTTLE_LIMIT: '1000',
    AUTH_THROTTLE_TTL_SECONDS: '60',
    CORS_ORIGINS: 'http://localhost:5173',
  });
}
