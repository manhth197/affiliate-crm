import type { LeadStatus, Product, User } from '@/api/types'
import { previousMonth, vnDay, vnDayStart, vnMonth } from '@/lib/dates'
import { commissionFor } from './commission'
import type { ActivityRecord, CommissionRecord, LeadRecord, PayoutRecord } from './records'

/**
 * Generates the contract's demo history: ~120 leads over the last 60 days in every status,
 * their activity timelines, commissions for disbursed leads and one paid payout.
 * A seeded PRNG keeps the data identical on every run (only dates move with "now").
 */

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const LEAD_COUNT = 120

/** mulberry32: tiny deterministic PRNG. */
function createRandom(seed: number) {
  let state = seed
  const next = () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!
  const weighted = <T>(entries: readonly (readonly [T, number])[]): T => {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
    let roll = next() * total
    for (const [value, weight] of entries) {
      roll -= weight
      if (roll < 0) return value
    }
    return entries[entries.length - 1]![0]
  }
  return { next, int, pick, weighted }
}

const FAMILY_NAMES = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
  'Bùi',
  'Đỗ',
  'Hồ',
  'Ngô',
  'Dương',
  'Lý',
]
const MIDDLE_NAMES = [
  'Văn',
  'Thị',
  'Minh',
  'Ngọc',
  'Thanh',
  'Quốc',
  'Thu',
  'Đức',
  'Hoài',
  'Gia',
  'Kim',
  'Hữu',
]
const GIVEN_NAMES = [
  'An',
  'Bình',
  'Châu',
  'Dũng',
  'Giang',
  'Hà',
  'Hải',
  'Hạnh',
  'Hiếu',
  'Hoa',
  'Hùng',
  'Khánh',
  'Lan',
  'Linh',
  'Long',
  'Mai',
  'Nam',
  'Ngân',
  'Phúc',
  'Phương',
  'Quang',
  'Sơn',
  'Tâm',
  'Thảo',
  'Trang',
  'Tuấn',
  'Vy',
  'Yến',
]
const PHONE_PREFIXES = [
  '090',
  '091',
  '093',
  '094',
  '096',
  '097',
  '098',
  '032',
  '035',
  '038',
  '070',
  '077',
  '081',
  '085',
]
const STAFF_NOTES = [
  'Khách hẹn gọi lại vào buổi chiều.',
  'Đã gửi danh sách giấy tờ cần chuẩn bị qua Zalo.',
  'Khách cần bổ sung sao kê lương 3 tháng.',
  'Hồ sơ đầy đủ, chuyển đối tác thẩm định.',
  'Khách muốn tăng hạn mức, đã tư vấn lại.',
]
const REJECT_NOTES = [
  'Khách không đủ điều kiện thu nhập.',
  'Khách không còn nhu cầu.',
  'Lịch sử tín dụng không đạt.',
  'Không liên lạc được với khách sau 3 lần gọi.',
]

const HAPPY_PATH: readonly LeadStatus[] = ['NEW', 'CONTACTED', 'SUBMITTED', 'APPROVED', 'DISBURSED']

/** Older leads are further along the pipeline. */
function pickStatus(random: ReturnType<typeof createRandom>, ageDays: number): LeadStatus {
  if (ageDays < 3) {
    return random.weighted([
      ['NEW', 60],
      ['CONTACTED', 30],
      ['REJECTED', 10],
    ] as const)
  }
  if (ageDays < 10) {
    return random.weighted([
      ['NEW', 15],
      ['CONTACTED', 30],
      ['SUBMITTED', 30],
      ['APPROVED', 10],
      ['REJECTED', 15],
    ] as const)
  }
  return random.weighted([
    ['NEW', 3],
    ['CONTACTED', 7],
    ['SUBMITTED', 15],
    ['APPROVED', 15],
    ['DISBURSED', 40],
    ['REJECTED', 20],
  ] as const)
}

function amountsFor(random: ReturnType<typeof createRandom>, product: Product) {
  const million = 1_000_000
  if (product.category === 'LOAN') {
    const [min, max] =
      product.commissionType === 'FIXED'
        ? [500, 3000]
        : product.name.includes('xe')
          ? [15, 60]
          : [20, 200]
    const requested = random.int(min, max) * million
    const disbursed = Math.round((requested * random.int(70, 100)) / 100 / million) * million
    return { requested, disbursed }
  }
  // Credit card: approved limit; insurance: yearly premium (the API requires an amount on DISBURSED).
  const disbursed =
    product.category === 'CREDIT_CARD' ? random.int(10, 80) * million : random.int(5, 20) * million
  return { requested: null, disbursed }
}

export type LeadSeed = {
  leads: LeadRecord[]
  activities: ActivityRecord[]
  commissions: CommissionRecord[]
  payouts: PayoutRecord[]
}

export function createLeadSeed(
  users: readonly User[],
  products: readonly Product[],
  now: number,
): LeadSeed {
  const random = createRandom(20261124)
  const uuid = (prefix: number, n: number) =>
    `00000000-0000-4000-${String(prefix).padStart(4, '0')}-${String(n).padStart(12, '0')}`

  const affiliates = users.filter((user) => user.role === 'AFFILIATE')
  const [admin] = users.filter((user) => user.role === 'ADMIN')
  const staff = users.filter((user) => user.role === 'STAFF')
  const handlers = [...staff, ...staff, ...staff, admin!] // staff do most of the work
  const affiliateWeights = affiliates.map((a, i) => [a, [50, 30, 20][i] ?? 10] as const)

  // Creation times, oldest first, so codes increase with time. Office hours 8:00–20:00 VN.
  const createdTimes = Array.from({ length: LEAD_COUNT }, () => {
    const day = new Date(now - random.int(0, 59) * DAY)
    const dayStart = Date.parse(vnDayStart(vnDay(day)))
    return Math.min(
      dayStart + random.int(8 * 60, 20 * 60) * 60 * 1000,
      now - random.int(5, 120) * 60 * 1000,
    )
  }).sort((a, b) => a - b)

  const leads: LeadRecord[] = []
  const activities: ActivityRecord[] = []
  const commissions: CommissionRecord[] = []
  let activitySeq = 0
  const addActivity = (activity: Omit<ActivityRecord, 'id'>) =>
    activities.push({ id: uuid(2, ++activitySeq), ...activity })

  createdTimes.forEach((createdAt, index) => {
    const n = index + 1
    const ageDays = (now - createdAt) / DAY
    const affiliate = random.weighted(affiliateWeights)
    const oldEnough = ageDays > 30
    const product = random.pick(products.filter((p) => p.active || oldEnough))
    const status = pickStatus(random, ageDays)
    const { requested, disbursed } = amountsFor(random, product)
    const leadId = uuid(1, n)
    const handler = random.pick(handlers)
    const assigned = status !== 'NEW' || random.next() < 0.5

    // Each pipeline step takes a few hours to ~4 days (shorter for young leads), never past now.
    let cursor = createdAt
    const maxStepHours = Math.max(3, Math.min(96, Math.floor((ageDays * 24) / 6)))
    const step = () => {
      cursor = Math.min(cursor + random.int(2, maxStepHours) * HOUR, now - 60_000)
      return new Date(cursor).toISOString()
    }

    addActivity({
      leadId,
      type: 'CREATED',
      fromStatus: null,
      toStatus: 'NEW',
      note: random.next() < 0.3 ? 'Khách quen, đã đồng ý cho liên hệ.' : null,
      actorId: affiliate.id,
      createdAt: new Date(createdAt).toISOString(),
    })
    if (assigned) {
      addActivity({
        leadId,
        type: 'ASSIGNED',
        fromStatus: null,
        toStatus: null,
        note: null,
        actorId: admin!.id,
        createdAt: step(),
      })
    }

    // Walk the happy path up to the final status (REJECTED leaves from a random open status).
    const target = status === 'REJECTED' ? HAPPY_PATH[random.int(0, 3)]! : status
    for (let i = 1; i <= HAPPY_PATH.indexOf(target); i++) {
      const fromStatus = HAPPY_PATH[i - 1]!
      const toStatus = HAPPY_PATH[i]!
      const viaWebhook =
        (toStatus === 'APPROVED' || toStatus === 'DISBURSED') && random.next() < 0.4
      addActivity({
        leadId,
        type: viaWebhook ? 'WEBHOOK' : 'STATUS_CHANGED',
        fromStatus,
        toStatus,
        note: null,
        actorId: viaWebhook ? null : handler.id,
        createdAt: step(),
      })
      if (toStatus === 'CONTACTED' && random.next() < 0.5) {
        addActivity({
          leadId,
          type: 'NOTE',
          fromStatus: null,
          toStatus: null,
          note: random.pick(STAFF_NOTES),
          actorId: handler.id,
          createdAt: step(),
        })
      }
    }
    if (status === 'REJECTED') {
      addActivity({
        leadId,
        type: 'STATUS_CHANGED',
        fromStatus: target,
        toStatus: 'REJECTED',
        note: random.pick(REJECT_NOTES),
        actorId: handler.id,
        createdAt: step(),
      })
    }

    const updatedAt = new Date(cursor).toISOString()
    leads.push({
      id: leadId,
      code: `LD-${String(n).padStart(6, '0')}`,
      affiliateId: affiliate.id,
      productId: product.id,
      customerName: `${random.pick(FAMILY_NAMES)} ${random.pick(MIDDLE_NAMES)} ${random.pick(GIVEN_NAMES)}`,
      customerPhone: `${random.pick(PHONE_PREFIXES)}${String(random.int(0, 9_999_999)).padStart(7, '0')}`,
      customerNationalId:
        random.next() < 0.7
          ? `0${random.int(1, 96).toString().padStart(2, '0')}${String(random.int(0, 999_999_999)).padStart(9, '0')}`
          : null,
      requestedAmount: requested,
      disbursedAmount: status === 'DISBURSED' ? disbursed : null,
      status,
      assignedStaffId: assigned ? handler.id : null,
      createdAt: new Date(createdAt).toISOString(),
      updatedAt,
    })

    if (status === 'DISBURSED') {
      commissions.push({
        id: uuid(3, commissions.length + 1),
        leadId,
        affiliateId: affiliate.id,
        amount: commissionFor(product, disbursed),
        status: 'PENDING', // decided below, once we know the months
        payoutId: null,
        // The BullMQ job runs a few minutes after the lead is disbursed.
        createdAt: new Date(Date.parse(updatedAt) + random.int(1, 10) * 60_000).toISOString(),
      })
    }
  })

  // Commission statuses: before this month → approved (paid for the first affiliate, through
  // one payout); this month → mostly pending, some approved, a few cancelled.
  const thisMonth = vnMonth(new Date(now))
  const lastMonth = previousMonth(thisMonth)
  const payoutAffiliate = affiliates[0]!
  const payoutId = uuid(4, 1)
  for (const commission of commissions) {
    if (vnMonth(commission.createdAt) < thisMonth) {
      if (commission.affiliateId === payoutAffiliate.id) {
        commission.status = 'PAID'
        commission.payoutId = payoutId
      } else {
        commission.status = 'APPROVED'
      }
    } else {
      commission.status = random.weighted([
        ['PENDING', 50],
        ['APPROVED', 40],
        ['CANCELLED', 10],
      ] as const)
    }
  }

  const paid = commissions.filter((c) => c.payoutId === payoutId)
  const monthStart = Date.parse(vnDayStart(`${thisMonth}-01`))
  const payouts: PayoutRecord[] = paid.length
    ? [
        {
          id: payoutId,
          affiliateId: payoutAffiliate.id,
          periodMonth: lastMonth,
          totalAmount: paid.reduce((sum, c) => sum + c.amount, 0),
          commissionCount: paid.length,
          status: 'PAID',
          paidAt: new Date(Math.min(monthStart + 4 * DAY + 10 * HOUR, now - HOUR)).toISOString(),
          createdAt: new Date(Math.min(monthStart + 9 * HOUR, now - 2 * HOUR)).toISOString(),
        },
      ]
    : []

  return { leads, activities, commissions, payouts }
}
