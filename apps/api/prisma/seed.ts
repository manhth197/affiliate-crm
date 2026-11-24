/**
 * Demo data (see "Seed data" in docs/api-contract.md). Idempotent: safe to run
 * repeatedly with `npm run db:seed`.
 *
 * M1 seeds the demo accounts only; products, leads, commissions and payouts
 * are added in M4.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { Role } from '../src/generated/prisma/enums';

const DEMO_PASSWORD = 'Demo@12345';

interface DemoUser {
  email: string;
  fullName: string;
  phone: string;
  role: Role;
  affiliate?: {
    referralCode: string;
    bankName?: string;
    bankAccount?: string;
  };
}

const USERS: DemoUser[] = [
  {
    email: 'admin@demo.vn',
    fullName: 'Lê Quản Trị',
    phone: '0901000001',
    role: Role.ADMIN,
  },
  {
    email: 'staff@demo.vn',
    fullName: 'Phạm Thu Hà',
    phone: '0901000002',
    role: Role.STAFF,
  },
  {
    email: 'ctv1@demo.vn',
    fullName: 'Nguyễn Văn An',
    phone: '0912000001',
    role: Role.AFFILIATE,
    affiliate: {
      referralCode: 'CTVDEMA22',
      bankName: 'Vietcombank',
      bankAccount: '0123456789',
    },
  },
  {
    email: 'ctv2@demo.vn',
    fullName: 'Trần Thị Bình',
    phone: '0912000002',
    role: Role.AFFILIATE,
    affiliate: { referralCode: 'CTVDEMA33' },
  },
  {
    email: 'ctv3@demo.vn',
    fullName: 'Lê Hoàng Cường',
    phone: '0912000003',
    role: Role.AFFILIATE,
    affiliate: { referralCode: 'CTVDEMA44' },
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const passwordHash = await argon2.hash(DEMO_PASSWORD, {
      type: argon2.argon2id,
    });
    for (const { affiliate, ...user } of USERS) {
      const profile = affiliate
        ? {
            referralCode: affiliate.referralCode,
            bankName: affiliate.bankName ?? null,
            bankAccount: affiliate.bankAccount ?? null,
          }
        : undefined;
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          ...user,
          passwordHash,
          ...(profile && {
            affiliateProfile: {
              upsert: { create: profile, update: profile },
            },
          }),
        },
        create: {
          ...user,
          passwordHash,
          ...(profile && { affiliateProfile: { create: profile } }),
        },
      });
    }
    console.log(
      `Seeded ${USERS.length} demo users (password: ${DEMO_PASSWORD})`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
