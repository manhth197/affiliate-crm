import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { AppConfig } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 7 talks to Postgres through a driver adapter (node-postgres here)
 * instead of the old Rust query engine. The pool connects lazily on the first
 * query, so tooling such as the OpenAPI export can boot the app without a DB.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
