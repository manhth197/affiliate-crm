import type { Redis } from 'ioredis';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthService, probe } from './health.service';

describe('probe', () => {
  it('is up when the check resolves', async () => {
    await expect(probe(() => Promise.resolve('PONG'))).resolves.toBe('up');
  });

  it('is down when the check rejects', async () => {
    await expect(
      probe(() => Promise.reject(new Error('ECONNREFUSED'))),
    ).resolves.toBe('down');
  });

  it('is down when the check hangs past the timeout', async () => {
    await expect(probe(() => new Promise(() => undefined), 20)).resolves.toBe(
      'down',
    );
  });
});

describe('HealthService', () => {
  function service(db: () => Promise<unknown>, redis: () => Promise<unknown>) {
    const prisma = { $queryRaw: jest.fn(db) } as unknown as PrismaService;
    const client = { ping: jest.fn(redis) } as unknown as Redis;
    return new HealthService(prisma, client);
  }

  it('reports ok when both dependencies answer', async () => {
    const health = service(
      () => Promise.resolve([{ '?column?': 1 }]),
      () => Promise.resolve('PONG'),
    );
    await expect(health.check()).resolves.toEqual({
      status: 'ok',
      db: 'up',
      redis: 'up',
    });
  });

  it('reports error and which dependency is down', async () => {
    const health = service(
      () => Promise.resolve([]),
      () => Promise.reject(new Error('down')),
    );
    await expect(health.check()).resolves.toEqual({
      status: 'error',
      db: 'up',
      redis: 'down',
    });
  });
});
