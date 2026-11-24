import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/auth/password.service';
import { Role, UserStatus } from '../src/generated/prisma/enums';
import { PrismaService } from '../src/prisma/prisma.service';

export const API = '/api/v1';
export const PASSWORD = 'Secret@123';

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

/** Boots the real AppModule (real Postgres + Redis), like main.ts does. */
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestContext> {
  const moduleRef = await customize(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return {
    app,
    prisma: app.get(PrismaService),
    http: () => request(app.getHttpServer()),
  };
}

/** Empties every table (keeps the migrations table). */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length > 0) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
    );
  }
}

let emailCounter = 0;
export function uniqueEmail(prefix = 'user'): string {
  emailCounter += 1;
  return `${prefix}.${Date.now()}.${emailCounter}@example.com`;
}

/** Inserts a STAFF/ADMIN (or any) user directly, since public sign-up only creates affiliates. */
export async function createUser(
  ctx: TestContext,
  options: { role: Role; status?: UserStatus; email?: string },
): Promise<{ id: string; email: string }> {
  const passwords = ctx.app.get(PasswordService);
  return ctx.prisma.user.create({
    data: {
      email: options.email ?? uniqueEmail(options.role.toLowerCase()),
      passwordHash: await passwords.hash(PASSWORD),
      fullName: `Test ${options.role}`,
      phone: '0987654321',
      role: options.role,
      status: options.status ?? UserStatus.ACTIVE,
    },
    select: { id: true, email: true },
  });
}

export async function login(
  ctx: TestContext,
  email: string,
  password = PASSWORD,
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await ctx
    .http()
    .post(`${API}/auth/login`)
    .send({ email, password })
    .expect(200);
  return {
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}
