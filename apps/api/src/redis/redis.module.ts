import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { AppConfig } from '../config/env.validation';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Shared ioredis client for simple commands (health check, caching).
 * BullMQ creates its own connections from REDIS_URL.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        new Redis(config.get('REDIS_URL', { infer: true }), {
          // Connect on the first command, not at import time.
          lazyConnect: true,
          // Fail a command quickly instead of retrying forever when Redis is down.
          maxRetriesPerRequest: 1,
        }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onApplicationShutdown(): void {
    this.redis.disconnect();
  }
}
