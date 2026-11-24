import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import type { HealthDto, ProbeStatus } from './health.dto';

const PROBE_TIMEOUT_MS = 1000;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthDto> {
    const [db, redis] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(() => this.redis.ping()),
    ]);
    return {
      status: db === 'up' && redis === 'up' ? 'ok' : 'error',
      db,
      redis,
    };
  }
}

/** Runs a dependency check with a timeout so a hung dependency cannot hang /health. */
export async function probe(
  check: () => Promise<unknown>,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<ProbeStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  try {
    await Promise.race([check(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}
