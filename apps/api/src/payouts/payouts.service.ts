import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { vnMonthRange } from '../common/dates';
import { type Paginated, pageArgs, toPage } from '../common/dto/pagination.dto';
import { conflict, ErrorCode } from '../common/errors/error-codes';
import type { Payout, Prisma } from '../generated/prisma/client';
import {
  CommissionStatus,
  PayoutStatus,
  Role,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import {
  type GeneratePayoutsJobData,
  PayoutJob,
  QueueName,
} from '../queues/queues';
import type { PayoutDto } from './dto/payout.dto';
import { PayoutEvents, PayoutStatusChangedEvent } from './payout.events';

const payoutInclude = {
  affiliate: { select: { id: true, fullName: true } },
} satisfies Prisma.PayoutInclude;

type PayoutWithAffiliate = Prisma.PayoutGetPayload<{
  include: typeof payoutInclude;
}>;

export function toPayoutDto(p: PayoutWithAffiliate): PayoutDto {
  return {
    id: p.id,
    affiliate: { id: p.affiliate.id, fullName: p.affiliate.fullName },
    periodMonth: p.periodMonth,
    totalAmount: Number(p.totalAmount),
    commissionCount: p.commissionCount,
    status: p.status,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

export interface GenerateResult {
  /** Payouts created or topped up (still DRAFT). */
  drafted: number;
  /** Affiliates skipped because their payout for the month is already confirmed or paid. */
  skipped: number;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    @InjectQueue(QueueName.Payouts) private readonly queue: Queue,
  ) {}

  async requestGeneration(
    month: string,
    requestedBy: string,
  ): Promise<{ jobId: string }> {
    const data: GeneratePayoutsJobData = { month, requestedBy };
    const job = await this.queue.add(PayoutJob.Generate, data);
    return { jobId: String(job.id) };
  }

  /**
   * Job handler: one DRAFT payout per affiliate for the month, holding every
   * APPROVED commission created that month and not yet in a payout. Safe to
   * re-run: UNIQUE(affiliate_id, period_month) keeps one payout, and a DRAFT
   * is topped up with commissions approved since the last run.
   */
  async generate(month: string, requestedBy: string): Promise<GenerateResult> {
    const range = vnMonthRange(month);
    const eligible = {
      status: CommissionStatus.APPROVED,
      payoutId: null,
      createdAt: range,
    } satisfies Prisma.CommissionWhereInput;
    const affiliates = await this.prisma.commission.groupBy({
      by: ['affiliateId'],
      where: eligible,
    });

    const result: GenerateResult = { drafted: 0, skipped: 0 };
    for (const { affiliateId } of affiliates) {
      const payout = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.payout.findUnique({
          where: {
            affiliateId_periodMonth: { affiliateId, periodMonth: month },
          },
        });
        if (existing && existing.status !== PayoutStatus.DRAFT) {
          return null;
        }
        const draft =
          existing ??
          (await tx.payout.create({
            data: {
              affiliateId,
              periodMonth: month,
              totalAmount: 0n,
              commissionCount: 0,
            },
          }));
        await tx.commission.updateMany({
          where: { ...eligible, affiliateId },
          data: { payoutId: draft.id },
        });
        // Totals are recomputed from the rows, never incremented, so a re-run
        // cannot double count.
        const totals = await tx.commission.aggregate({
          where: { payoutId: draft.id },
          _sum: { amount: true },
          _count: true,
        });
        const updated = await tx.payout.update({
          where: { id: draft.id },
          data: {
            totalAmount: totals._sum.amount ?? 0n,
            commissionCount: totals._count,
          },
        });
        await this.audit.record(
          {
            actorId: requestedBy,
            action: 'PAYOUT_GENERATED',
            entityType: 'Payout',
            entityId: updated.id,
            after: {
              periodMonth: month,
              totalAmount: Number(updated.totalAmount),
              commissionCount: updated.commissionCount,
            },
          },
          tx,
        );
        return updated;
      });

      if (payout) {
        result.drafted += 1;
        this.emitStatus(payout);
      } else {
        result.skipped += 1;
        this.logger.warn(
          `Payout ${month} of affiliate ${affiliateId} is already confirmed/paid; new commissions left for review`,
        );
      }
    }
    return result;
  }

  async list(
    query: { status?: PayoutStatus; month?: string; affiliateId?: string } & {
      page: number;
      pageSize: number;
    },
    viewer: AuthUser,
  ): Promise<Paginated<PayoutDto>> {
    const where: Prisma.PayoutWhereInput = {
      affiliateId:
        viewer.role === Role.AFFILIATE ? viewer.id : query.affiliateId,
      status: query.status,
      periodMonth: query.month,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payout.findMany({
        where,
        include: payoutInclude,
        orderBy: [
          { periodMonth: 'desc' },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        ...pageArgs(query),
      }),
      this.prisma.payout.count({ where }),
    ]);
    return toPage(items.map(toPayoutDto), total, query);
  }

  confirm(id: string, actorId: string): Promise<PayoutDto> {
    return this.transition(id, actorId, {
      from: PayoutStatus.DRAFT,
      to: PayoutStatus.CONFIRMED,
      action: 'PAYOUT_CONFIRMED',
    });
  }

  /** CONFIRMED → PAID, and every commission in it → PAID, atomically. */
  markPaid(id: string, actorId: string): Promise<PayoutDto> {
    return this.transition(id, actorId, {
      from: PayoutStatus.CONFIRMED,
      to: PayoutStatus.PAID,
      action: 'PAYOUT_PAID',
    });
  }

  private async transition(
    id: string,
    actorId: string,
    rule: {
      from: PayoutStatus;
      to: PayoutStatus;
      action: 'PAYOUT_CONFIRMED' | 'PAYOUT_PAID';
    },
  ): Promise<PayoutDto> {
    const payout = await this.prisma.$transaction(async (tx) => {
      const current = await tx.payout.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) {
        throw new NotFoundException('Payout not found');
      }
      const paidAt = rule.to === PayoutStatus.PAID ? new Date() : undefined;
      const { count } = await tx.payout.updateMany({
        where: { id, status: rule.from },
        data: { status: rule.to, ...(paidAt && { paidAt }) },
      });
      if (count !== 1) {
        throw conflict(
          ErrorCode.INVALID_PAYOUT_STATUS,
          `Only ${rule.from} payouts can become ${rule.to} (current: ${current.status})`,
        );
      }
      if (rule.to === PayoutStatus.PAID) {
        await tx.commission.updateMany({
          where: { payoutId: id, status: CommissionStatus.APPROVED },
          data: { status: CommissionStatus.PAID },
        });
      }
      await this.audit.record(
        {
          actorId,
          action: rule.action,
          entityType: 'Payout',
          entityId: id,
          before: { status: current.status },
          after: { status: rule.to },
        },
        tx,
      );
      return tx.payout.findUniqueOrThrow({
        where: { id },
        include: payoutInclude,
      });
    });
    this.emitStatus(payout);
    return toPayoutDto(payout);
  }

  private emitStatus(payout: Payout): void {
    this.events.emit(
      PayoutEvents.StatusChanged,
      new PayoutStatusChangedEvent(
        payout.id,
        payout.affiliateId,
        payout.periodMonth,
        payout.status,
        Number(payout.totalAmount),
        payout.commissionCount,
      ),
    );
  }
}
