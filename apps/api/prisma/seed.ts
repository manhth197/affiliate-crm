/**
 * Demo data (see "Seed data" in docs/api-contract.md). Idempotent: safe to run
 * repeatedly with `npm run db:seed`.
 *
 * Seeds demo accounts and products. Leads, commissions and payouts are added
 * in M4. Partner names are fictional.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  CommissionType,
  ProductCategory,
  Role,
} from '../src/generated/prisma/enums';

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

/** Fixed ids so re-running the seed updates instead of duplicating. */
const PRODUCTS = [
  {
    id: '01900000-0000-7000-8000-000000000001',
    name: 'Vay tiêu dùng tín chấp',
    partnerName: 'Tài chính An Phát',
    category: ProductCategory.LOAN,
    commissionType: CommissionType.PERCENT,
    commissionValue: 150, // 1.5%
  },
  {
    id: '01900000-0000-7000-8000-000000000002',
    name: 'Vay mua xe trả góp',
    partnerName: 'Ngân hàng Sao Việt',
    category: ProductCategory.LOAN,
    commissionType: CommissionType.PERCENT,
    commissionValue: 80, // 0.8%
  },
  {
    id: '01900000-0000-7000-8000-000000000003',
    name: 'Thẻ tín dụng Sao Việt Platinum',
    partnerName: 'Ngân hàng Sao Việt',
    category: ProductCategory.CREDIT_CARD,
    commissionType: CommissionType.FIXED,
    commissionValue: 500_000,
  },
  {
    id: '01900000-0000-7000-8000-000000000004',
    name: 'Thẻ tín dụng Hưng Thịnh Cashback',
    partnerName: 'Ngân hàng Hưng Thịnh',
    category: ProductCategory.CREDIT_CARD,
    commissionType: CommissionType.FIXED,
    commissionValue: 400_000,
  },
  {
    id: '01900000-0000-7000-8000-000000000005',
    name: 'Bảo hiểm sức khoẻ gia đình',
    partnerName: 'Bảo hiểm Toàn Tâm',
    category: ProductCategory.INSURANCE,
    commissionType: CommissionType.PERCENT,
    commissionValue: 1_000, // 10%
  },
  {
    id: '01900000-0000-7000-8000-000000000006',
    name: 'Bảo hiểm xe máy',
    partnerName: 'Bảo hiểm Toàn Tâm',
    category: ProductCategory.INSURANCE,
    commissionType: CommissionType.FIXED,
    commissionValue: 30_000,
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
    for (const { id, ...product } of PRODUCTS) {
      await prisma.product.upsert({
        where: { id },
        update: product,
        create: { id, ...product },
      });
    }
    console.log(
      `Seeded ${USERS.length} demo users (password: ${DEMO_PASSWORD}) and ${PRODUCTS.length} products`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
