import { Injectable } from '@nestjs/common';
import { CommissionStatus, LeadStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import type { ReportOverviewDto, TopAffiliateDto } from './dto/report.dto';
import { fillDays, type ReportRange } from './report-range';

/** Vietnam calendar for per-day buckets (contract v0.2). */
const TIMEZONE = 'Asia/Ho_Chi_Minh';

function zeroed<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(range: ReportRange): Promise<ReportOverviewDto> {
    const createdAt = { gte: range.from, lt: range.to };
    const [leadGroups, disbursed, commissionGroups, perDay] = await Promise.all(
      [
        this.prisma.lead.groupBy({
          by: ['status'],
          where: { createdAt },
          _count: { _all: true },
        }),
        this.prisma.lead.aggregate({
          where: { createdAt, status: LeadStatus.DISBURSED },
          _sum: { disbursedAmount: true },
        }),
        this.prisma.commission.groupBy({
          by: ['status'],
          where: { createdAt },
          _sum: { amount: true },
        }),
        // Grouping by local day needs AT TIME ZONE, which Prisma's query
        // builder cannot express; parameters are still bound, not interpolated.
        this.prisma.$queryRaw<{ date: string; count: number }[]>`
          SELECT to_char(created_at AT TIME ZONE ${TIMEZONE}, 'YYYY-MM-DD') AS date,
                 count(*)::int AS count
          FROM leads
          WHERE created_at >= ${range.from} AND created_at < ${range.to}
          GROUP BY 1
          ORDER BY 1`,
      ],
    );

    const leadsByStatus = zeroed(Object.values(LeadStatus));
    for (const group of leadGroups) {
      leadsByStatus[group.status] = group._count._all;
    }
    const total = Object.values(leadsByStatus).reduce((a, b) => a + b, 0);
    const commissionByStatus = zeroed(Object.values(CommissionStatus));
    for (const group of commissionGroups) {
      commissionByStatus[group.status] = Number(group._sum.amount ?? 0n);
    }

    return {
      leadsByStatus,
      conversionRate:
        total === 0
          ? 0
          : Math.round((leadsByStatus.DISBURSED / total) * 10_000) / 10_000,
      disbursedAmount: Number(disbursed._sum.disbursedAmount ?? 0n),
      commissionByStatus,
      leadsPerDay: fillDays(range, perDay),
    };
  }

  /** Ranked by commission, then disbursed leads, then leads. */
  async topAffiliates(
    range: ReportRange,
    limit: number,
  ): Promise<TopAffiliateDto[]> {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        fullName: string;
        referralCode: string;
        leads: number;
        disbursed: number;
        commission: bigint;
      }[]
    >`
      SELECT u.id,
             u.full_name AS "fullName",
             ap.referral_code AS "referralCode",
             COALESCE(l.leads, 0)::int AS leads,
             COALESCE(l.disbursed, 0)::int AS disbursed,
             COALESCE(c.commission, 0)::bigint AS commission
      FROM users u
      JOIN affiliate_profiles ap ON ap.user_id = u.id
      LEFT JOIN (
        SELECT affiliate_id,
               count(*) AS leads,
               count(*) FILTER (WHERE status = 'DISBURSED') AS disbursed
        FROM leads
        WHERE created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY affiliate_id
      ) l ON l.affiliate_id = u.id
      LEFT JOIN (
        SELECT affiliate_id, sum(amount) AS commission
        FROM commissions
        WHERE status <> 'CANCELLED'
          AND created_at >= ${range.from} AND created_at < ${range.to}
        GROUP BY affiliate_id
      ) c ON c.affiliate_id = u.id
      WHERE l.leads IS NOT NULL OR c.commission IS NOT NULL
      ORDER BY commission DESC, disbursed DESC, leads DESC, u.full_name
      LIMIT ${limit}`;

    return rows.map((r) => ({
      affiliate: {
        id: r.id,
        fullName: r.fullName,
        referralCode: r.referralCode,
      },
      leads: r.leads,
      disbursed: r.disbursed,
      commission: Number(r.commission),
    }));
  }
}
