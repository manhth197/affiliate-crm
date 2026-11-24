import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { APP_OPTIONS, configureApp } from '../src/app.setup';
import { PasswordService } from '../src/users/password.service';
import {
  CommissionType,
  ProductCategory,
  Role,
  UserStatus,
} from '../src/generated/prisma/enums';
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
  const app =
    moduleRef.createNestApplication<INestApplication<App>>(APP_OPTIONS);
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
  options: {
    role: Role;
    status?: UserStatus;
    email?: string;
    fullName?: string;
  },
): Promise<{ id: string; email: string }> {
  const passwords = ctx.app.get(PasswordService);
  return ctx.prisma.user.create({
    data: {
      email: options.email ?? uniqueEmail(options.role.toLowerCase()),
      passwordHash: await passwords.hash(PASSWORD),
      fullName: options.fullName ?? `Test ${options.role}`,
      phone: '0987654321',
      role: options.role,
      status: options.status ?? UserStatus.ACTIVE,
    },
    select: { id: true, email: true },
  });
}

export interface Actor {
  id: string;
  email: string;
  token: string;
}

/** A logged-in user of any role (affiliates get a profile via the real sign-up). */
export async function actor(
  ctx: TestContext,
  role: Role,
  fullName?: string,
): Promise<Actor> {
  if (role === Role.AFFILIATE) {
    const email = uniqueEmail('ctv');
    const res = await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({
        email,
        password: PASSWORD,
        fullName: fullName ?? 'Test CTV',
        phone: '0912000999',
      })
      .expect(201);
    return { id: res.body.user.id, email, token: res.body.accessToken };
  }
  const user = await createUser(ctx, { role, fullName });
  const { accessToken } = await login(ctx, user.email);
  return { ...user, token: accessToken };
}

export function bearer(who: Actor): [string, string] {
  return ['Authorization', `Bearer ${who.token}`];
}

export async function createProduct(
  ctx: TestContext,
  overrides: Partial<{
    name: string;
    partnerName: string;
    category: ProductCategory;
    commissionType: CommissionType;
    commissionValue: number;
    active: boolean;
  }> = {},
): Promise<{ id: string }> {
  return ctx.prisma.product.create({
    data: {
      name: 'Vay tiêu dùng tín chấp',
      partnerName: 'FE Credit',
      category: ProductCategory.LOAN,
      commissionType: CommissionType.PERCENT,
      commissionValue: 150,
      ...overrides,
    },
    select: { id: true },
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

/** Polls until `check` returns a truthy value (background jobs are asynchronous). */
export async function waitFor<T>(
  check: () =>
    T | null | undefined | false | Promise<T | null | undefined | false>,
  { timeoutMs = 5000, intervalMs = 50 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) {
      return value;
    }
    if (Date.now() > deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

let leadPhoneCounter = 0;
/** A distinct customer phone, so the duplicate-lead rule never interferes. */
export function nextCustomerPhone(): string {
  leadPhoneCounter += 1;
  return `03${String(10_000_000 + leadPhoneCounter + process.pid).slice(-8)}`;
}

/** Affiliate submits a lead through the API. */
export async function submitLead(
  ctx: TestContext,
  affiliate: Actor,
  productId: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; code: string }> {
  const res = await ctx
    .http()
    .post(`${API}/leads`)
    .set(...bearer(affiliate))
    .send({
      productId,
      customerName: 'Khách Hàng Test',
      customerPhone: nextCustomerPhone(),
      ...overrides,
    })
    .expect(201);
  return { id: res.body.id, code: res.body.code };
}

/** Staff moves a lead step by step up to (and including) `target`. */
export async function advanceLead(
  ctx: TestContext,
  staff: Actor,
  leadId: string,
  target: 'CONTACTED' | 'SUBMITTED' | 'APPROVED' | 'DISBURSED',
  disbursedAmount = 50_000_000,
): Promise<void> {
  const steps = ['CONTACTED', 'SUBMITTED', 'APPROVED', 'DISBURSED'];
  for (const status of steps.slice(0, steps.indexOf(target) + 1)) {
    await ctx
      .http()
      .patch(`${API}/leads/${leadId}/status`)
      .set(...bearer(staff))
      .send(status === 'DISBURSED' ? { status, disbursedAmount } : { status })
      .expect(200);
  }
}
