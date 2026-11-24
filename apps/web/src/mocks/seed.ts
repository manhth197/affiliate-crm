import type { AffiliateProfile, Product, User } from '@/api/types'

/**
 * Demo data matching the "Seed data" section of docs/api-contract.md.
 * IDs are fixed so links stay valid across reloads; dates are relative to "now".
 */
export const DEMO_PASSWORD = 'Demo@12345'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (days: number, now: number) => new Date(now - days * DAY).toISOString()
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export type SeedData = {
  users: User[]
  passwords: Record<string, string>
  affiliates: AffiliateProfile[]
  products: Product[]
}

export function createSeed(now = Date.now()): SeedData {
  const users: User[] = [
    {
      id: id(1),
      email: 'admin@demo.vn',
      fullName: 'Trần Minh Quân',
      phone: '0903123456',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: daysAgo(120, now),
    },
    {
      id: id(2),
      email: 'staff@demo.vn',
      fullName: 'Lê Thu Hà',
      phone: '0938456789',
      role: 'STAFF',
      status: 'ACTIVE',
      createdAt: daysAgo(110, now),
    },
    {
      id: id(11),
      email: 'ctv1@demo.vn',
      fullName: 'Nguyễn Văn An',
      phone: '0912345678',
      role: 'AFFILIATE',
      status: 'ACTIVE',
      createdAt: daysAgo(90, now),
    },
    {
      id: id(12),
      email: 'ctv2@demo.vn',
      fullName: 'Phạm Thị Bình',
      phone: '0987654321',
      role: 'AFFILIATE',
      status: 'ACTIVE',
      createdAt: daysAgo(80, now),
    },
    {
      id: id(13),
      email: 'ctv3@demo.vn',
      fullName: 'Hoàng Đức Cường',
      phone: '0356789012',
      role: 'AFFILIATE',
      status: 'ACTIVE',
      createdAt: daysAgo(70, now),
    },
  ]

  const affiliates: AffiliateProfile[] = [
    {
      userId: id(11),
      referralCode: 'CTV001',
      bankName: 'Vietcombank',
      bankAccountMasked: '******6789',
    },
    {
      userId: id(12),
      referralCode: 'CTV002',
      bankName: 'Techcombank',
      bankAccountMasked: '******4321',
    },
    { userId: id(13), referralCode: 'CTV003', bankName: null, bankAccountMasked: null },
  ]

  const product = (
    n: number,
    fields: Omit<Product, 'id' | 'createdAt' | 'active'> & { active?: boolean },
  ): Product => ({ id: id(100 + n), active: true, createdAt: daysAgo(100, now), ...fields })

  const products: Product[] = [
    product(1, {
      name: 'Vay tiêu dùng tín chấp',
      partnerName: 'FE Credit',
      category: 'LOAN',
      commissionType: 'PERCENT',
      commissionValue: 150,
    }),
    product(2, {
      name: 'Vay mua xe máy trả góp',
      partnerName: 'Home Credit',
      category: 'LOAN',
      commissionType: 'PERCENT',
      commissionValue: 100,
    }),
    product(3, {
      name: 'Vay thế chấp nhà đất',
      partnerName: 'Vietcombank',
      category: 'LOAN',
      commissionType: 'FIXED',
      commissionValue: 2_000_000,
      active: false,
    }),
    product(4, {
      name: 'Thẻ tín dụng hoàn tiền',
      partnerName: 'VPBank',
      category: 'CREDIT_CARD',
      commissionType: 'FIXED',
      commissionValue: 300_000,
    }),
    product(5, {
      name: 'Thẻ tín dụng du lịch',
      partnerName: 'Techcombank',
      category: 'CREDIT_CARD',
      commissionType: 'FIXED',
      commissionValue: 400_000,
    }),
    product(6, {
      name: 'Bảo hiểm sức khỏe gia đình',
      partnerName: 'Bảo Việt',
      category: 'INSURANCE',
      commissionType: 'FIXED',
      commissionValue: 250_000,
    }),
  ]

  const passwords = Object.fromEntries(users.map((user) => [user.id, DEMO_PASSWORD]))

  return { users, passwords, affiliates, products }
}
