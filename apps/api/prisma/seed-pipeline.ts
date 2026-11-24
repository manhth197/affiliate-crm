/**
 * Demo pipeline for the seed: ~120 leads over the last 60 days in every
 * status, with a realistic timeline (activities), commissions for disbursed
 * leads, one PAID payout and a few notifications. Deterministic: the same
 * seed always produces the same data (relative to "now").
 */
import { calculateCommission } from '../src/commissions/commission-calculator';
import { vnMonth, vnMonthRange } from '../src/common/dates';
import { toSearchText } from '../src/common/search-text';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client';
import {
  CommissionStatus,
  LeadActivityType,
  LeadStatus,
  PayoutStatus,
  ProductCategory,
} from '../src/generated/prisma/enums';
import { formatLeadCode } from '../src/leads/lead-code';
import {
  commissionCreatedMessage,
  leadStatusChangedMessage,
  type NotificationMessage,
  payoutPaidMessage,
} from '../src/notifications/notification-messages';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const PIPELINE: LeadStatus[] = [
  LeadStatus.CONTACTED,
  LeadStatus.SUBMITTED,
  LeadStatus.APPROVED,
  LeadStatus.DISBURSED,
];
/** Partner configured in .env.example: its approvals and disbursals arrive by webhook. */
const WEBHOOK_PARTNER = 'Tài chính An Phát';

/** How many leads end in each status, and how old (days) they can be. */
const PLAN: { status: LeadStatus; count: number; age: [number, number] }[] = [
  { status: LeadStatus.NEW, count: 18, age: [0, 10] },
  { status: LeadStatus.CONTACTED, count: 18, age: [1, 20] },
  { status: LeadStatus.SUBMITTED, count: 18, age: [3, 35] },
  { status: LeadStatus.APPROVED, count: 14, age: [5, 45] },
  { status: LeadStatus.DISBURSED, count: 36, age: [7, 60] },
  { status: LeadStatus.REJECTED, count: 16, age: [2, 60] },
];

const SURNAMES = [
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
];
const MIDDLE = [
  'Văn',
  'Thị',
  'Minh',
  'Ngọc',
  'Thanh',
  'Hữu',
  'Đức',
  'Thu',
  'Quốc',
  'Gia',
];
const GIVEN = [
  'An',
  'Bình',
  'Chi',
  'Dũng',
  'Giang',
  'Hà',
  'Hải',
  'Hạnh',
  'Hùng',
  'Hương',
  'Khánh',
  'Lan',
  'Linh',
  'Long',
  'Mai',
  'Nam',
  'Nga',
  'Phúc',
  'Quân',
  'Sơn',
  'Tâm',
  'Thảo',
  'Trang',
  'Tuấn',
  'Vy',
  'Yến',
];
const REJECT_REASONS = [
  'Khách không đủ điều kiện thu nhập',
  'Nợ xấu nhóm 2',
  'Khách đổi ý, không vay nữa',
  'Không liên lạc được khách',
];

/** mulberry32: tiny deterministic PRNG. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) =>
      min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  };
}

type Random = ReturnType<typeof createRandom>;

/** Realistic time each step takes after the previous one. */
function stepDuration(to: LeadStatus, random: Random): number {
  switch (to) {
    case LeadStatus.CONTACTED:
      return random.int(2, 24) * HOUR;
    case LeadStatus.SUBMITTED:
      return random.int(1, 3) * DAY;
    case LeadStatus.APPROVED:
      return random.int(2, 5) * DAY;
    case LeadStatus.DISBURSED:
      return random.int(1, 4) * DAY;
    default:
      return random.int(1, 5) * DAY; // REJECTED
  }
}

/**
 * Timestamps for each status change: realistic step durations after the
 * assignment, squeezed proportionally if the lead is too young for them, and
 * always strictly increasing and in the past.
 */
function stepTimes(
  createdAt: Date,
  assignedAt: Date,
  steps: LeadStatus[],
  now: Date,
  random: Random,
): Date[] {
  const durations = steps.map((to) => stepDuration(to, random));
  const total = durations.reduce((a, b) => a + b, 0);
  const start = assignedAt.getTime() + HOUR / 2;
  const available = now.getTime() - HOUR - start;
  const scale = total > available ? Math.max(available, 0) / total : 1;
  let at = start;
  return durations.map((duration) => {
    at += Math.max(duration * scale, 10 * 60 * 1000);
    return new Date(Math.min(at, now.getTime() - 60 * 1000));
  });
}

interface Context {
  staffId: string;
  adminId: string;
  affiliates: { id: string; weight: number }[];
  products: {
    id: string;
    category: ProductCategory;
    partnerName: string;
    commissionType: 'PERCENT' | 'FIXED';
    commissionValue: number;
  }[];
}

export async function seedPipeline(
  prisma: PrismaClient,
  ctx: Context,
  now = new Date(),
): Promise<string> {
  if ((await prisma.lead.count()) > 0) {
    return 'leads already exist: pipeline skipped (run `npm run db:reset` for a fresh demo)';
  }
  // Empty table: start lead codes at LD-000001 again.
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('leads', 'number'), 1, false)`;

  const random = createRandom(20261124);
  const usedPhones = new Set<string>();
  const currentMonth = vnMonth(now);
  const previousMonth = vnMonth(
    new Date(vnMonthRange(currentMonth).gte.getTime() - 1),
  );
  const notifications: { message: NotificationMessage; at: Date }[] = [];
  const payoutCommissions: { id: string; amount: bigint }[] = [];
  let olderCommissions = 0;
  const [payoutAffiliate] = ctx.affiliates;

  const pickAffiliate = () => {
    let roll = random.next();
    for (const affiliate of ctx.affiliates) {
      roll -= affiliate.weight;
      if (roll <= 0) return affiliate.id;
    }
    return ctx.affiliates[0].id;
  };
  const phone = () => {
    for (;;) {
      const candidate = `09${String(random.int(10_000_000, 99_999_999))}`;
      if (!usedPhones.has(candidate)) {
        usedPhones.add(candidate);
        return candidate;
      }
    }
  };

  const plan = PLAN.flatMap((p) => Array.from({ length: p.count }, () => p));
  // Oldest first, so lead codes roughly follow creation time.
  const drafts = plan
    .map((p) => {
      const ageMs = random.int(p.age[0] * DAY, p.age[1] * DAY);
      return {
        target: p.status,
        createdAt: new Date(now.getTime() - ageMs - HOUR),
      };
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const draft of drafts) {
    const affiliateId = pickAffiliate();
    const product = random.pick(ctx.products);
    const customerName = `${random.pick(SURNAMES)} ${random.pick(MIDDLE)} ${random.pick(GIVEN)}`;
    const requested =
      product.category === ProductCategory.LOAN
        ? BigInt(random.int(10, 300)) * 1_000_000n
        : null;

    const steps =
      draft.target === LeadStatus.REJECTED
        ? [...PIPELINE.slice(0, random.int(0, 3)), LeadStatus.REJECTED]
        : PIPELINE.slice(0, PIPELINE.indexOf(draft.target) + 1);
    const assigned = steps.length > 0;
    const assignedAt = new Date(
      draft.createdAt.getTime() + random.int(1, 5) * HOUR,
    );
    const times = stepTimes(draft.createdAt, assignedAt, steps, now, random);

    let disbursedAmount: bigint | null = null;
    if (draft.target === LeadStatus.DISBURSED) {
      disbursedAmount =
        product.category === ProductCategory.LOAN
          ? ((requested! * BigInt(random.int(80, 100))) / 100n / 1_000_000n) *
            1_000_000n
          : product.category === ProductCategory.INSURANCE
            ? BigInt(random.int(3, 20)) * 1_000_000n
            : 0n;
    }

    const activities: Prisma.LeadActivityCreateWithoutLeadInput[] = [
      {
        type: LeadActivityType.CREATED,
        toStatus: LeadStatus.NEW,
        note: random.chance(0.3) ? 'Khách quen giới thiệu' : null,
        actor: { connect: { id: affiliateId } },
        createdAt: draft.createdAt,
      },
    ];
    if (assigned) {
      activities.push({
        type: LeadActivityType.ASSIGNED,
        actor: { connect: { id: ctx.adminId } },
        assignee: { connect: { id: ctx.staffId } },
        createdAt: assignedAt,
      });
    }
    let from: LeadStatus = LeadStatus.NEW;
    steps.forEach((to, i) => {
      const viaWebhook =
        product.partnerName === WEBHOOK_PARTNER &&
        (to === LeadStatus.APPROVED || to === LeadStatus.DISBURSED);
      activities.push({
        type: viaWebhook
          ? LeadActivityType.WEBHOOK
          : LeadActivityType.STATUS_CHANGED,
        fromStatus: from,
        toStatus: to,
        note: to === LeadStatus.REJECTED ? random.pick(REJECT_REASONS) : null,
        ...(viaWebhook ? {} : { actor: { connect: { id: ctx.staffId } } }),
        createdAt: times[i],
      });
      from = to;
    });
    const lastAt = activities.reduce(
      (max, a) => (a.createdAt! > max ? (a.createdAt as Date) : max),
      draft.createdAt,
    );

    const lead = await prisma.lead.create({
      data: {
        affiliateId,
        productId: product.id,
        customerName,
        customerNameSearch: toSearchText(customerName),
        customerPhone: phone(),
        customerNationalId: random.chance(0.7)
          ? `0${String(random.int(10_000_000, 99_999_999))}${random.int(100, 999)}`
          : null,
        requestedAmount: requested,
        disbursedAmount,
        status: draft.target,
        assignedStaffId: assigned ? ctx.staffId : null,
        createdAt: draft.createdAt,
        updatedAt: lastAt,
        activities: { create: activities },
      },
    });
    const code = formatLeadCode(lead.number);

    if (steps.length > 0 && now.getTime() - lastAt.getTime() < 10 * DAY) {
      notifications.push({
        message: leadStatusChangedMessage({
          affiliateId,
          leadId: lead.id,
          leadCode: code,
          from: steps.length > 1 ? steps[steps.length - 2] : LeadStatus.NEW,
          to: steps[steps.length - 1],
        }),
        at: lastAt,
      });
    }

    if (disbursedAmount !== null) {
      const amount = calculateCommission(product, disbursedAmount);
      const month = vnMonth(lastAt);
      const inPayout =
        affiliateId === payoutAffiliate.id && month === previousMonth;
      const status = inPayout
        ? CommissionStatus.PAID
        : month === currentMonth
          ? random.pick([CommissionStatus.PENDING, CommissionStatus.APPROVED])
          : olderCommissions++ % 4 === 0
            ? CommissionStatus.CANCELLED
            : CommissionStatus.APPROVED;
      const commission = await prisma.commission.create({
        data: {
          leadId: lead.id,
          affiliateId,
          amount,
          status,
          cancelReason:
            status === CommissionStatus.CANCELLED
              ? 'Khách tất toán trước hạn trong 30 ngày'
              : null,
          createdAt: lastAt,
          updatedAt: lastAt,
        },
      });
      if (inPayout) {
        payoutCommissions.push({ id: commission.id, amount });
      }
      if (now.getTime() - lastAt.getTime() < 10 * DAY) {
        notifications.push({
          message: commissionCreatedMessage({
            affiliateId,
            commissionId: commission.id,
            leadId: lead.id,
            leadCode: code,
            amount: Number(amount),
          }),
          at: lastAt,
        });
      }
    }
  }

  // One PAID payout: the main affiliate's commissions of last month.
  if (payoutCommissions.length === 0) {
    throw new Error(
      'Seed produced no commissions for the paid payout; change the PRNG seed',
    );
  }
  const totalAmount = payoutCommissions.reduce((sum, c) => sum + c.amount, 0n);
  const paidAt = new Date(
    Math.min(
      vnMonthRange(currentMonth).gte.getTime() + 4 * DAY + 3 * HOUR,
      now.getTime() - HOUR,
    ),
  );
  const payout = await prisma.payout.create({
    data: {
      affiliateId: payoutAffiliate.id,
      periodMonth: previousMonth,
      totalAmount,
      commissionCount: payoutCommissions.length,
      status: PayoutStatus.PAID,
      paidAt,
      createdAt: new Date(paidAt.getTime() - 2 * DAY),
      commissions: { connect: payoutCommissions.map((c) => ({ id: c.id })) },
    },
  });
  notifications.push({
    message: payoutPaidMessage({
      affiliateId: payout.affiliateId,
      payoutId: payout.id,
      periodMonth: payout.periodMonth,
      totalAmount: Number(totalAmount),
      commissionCount: payout.commissionCount,
    }),
    at: paidAt,
  });

  // Older notifications are already read; the last few days are unread.
  await prisma.notification.createMany({
    data: notifications.map(({ message, at }) => ({
      ...message,
      createdAt: at,
      readAt:
        now.getTime() - at.getTime() > 3 * DAY
          ? new Date(at.getTime() + HOUR)
          : null,
    })),
  });

  return `${drafts.length} leads, ${await prisma.commission.count()} commissions, 1 paid payout (${previousMonth}, ${payoutCommissions.length} commissions), ${notifications.length} notifications`;
}
