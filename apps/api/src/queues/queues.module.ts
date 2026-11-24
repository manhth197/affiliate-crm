import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/env.validation';
import { bullConnectionFromUrl } from '../redis/redis-url';

/**
 * Shared BullMQ setup. Retries with exponential backoff (1s, 2s, 4s, …) cover
 * short outages of the DB; completed jobs are trimmed so Redis does not grow.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        connection: bullConnectionFromUrl(
          config.get('REDIS_URL', { infer: true }),
        ),
        prefix: 'crm',
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
