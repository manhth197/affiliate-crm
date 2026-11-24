import type { RedisOptions } from 'ioredis';

/**
 * Connection options for BullMQ from a redis:// URL. BullMQ workers need
 * `maxRetriesPerRequest: null` (block until Redis is back instead of failing
 * jobs while it restarts).
 */
export function bullConnectionFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  const db = parsed.pathname.replace('/', '');
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    ...(parsed.username && { username: decodeURIComponent(parsed.username) }),
    ...(parsed.password && { password: decodeURIComponent(parsed.password) }),
    ...(db && { db: Number(db) }),
    ...(parsed.protocol === 'rediss:' && { tls: {} }),
    maxRetriesPerRequest: null,
  };
}
