import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Redis } from 'ioredis';
import { Client } from 'pg';
import { applyTestEnv } from './test-env';

/**
 * Runs once before all e2e suites: creates the test database if needed and
 * applies migrations with `prisma migrate deploy` (non-destructive), and
 * empties the test Redis database (old BullMQ jobs). Each suite then
 * truncates the tables it needs.
 */
export default async function globalSetup(): Promise<void> {
  applyTestEnv();
  const databaseUrl = process.env.DATABASE_URL as string;
  await ensureDatabaseExists(databaseUrl);
  await flushTestRedis(process.env.REDIS_URL as string);
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
  });
}

async function ensureDatabaseExists(databaseUrl: string): Promise<void> {
  const target = new URL(databaseUrl);
  const databaseName = target.pathname.slice(1);
  const maintenance = new URL(databaseUrl);
  maintenance.pathname = '/postgres';

  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );
    if (!rowCount) {
      // Identifier cannot be a bind parameter; the name was validated in applyTestEnv.
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }
}

/** The test Redis URL points at a separate logical DB (/1), never the dev one. */
async function flushTestRedis(redisUrl: string): Promise<void> {
  const redis = new Redis(redisUrl, { lazyConnect: true });
  await redis.connect();
  try {
    await redis.flushdb();
  } finally {
    redis.disconnect();
  }
}
