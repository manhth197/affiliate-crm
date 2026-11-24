import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { vnMonthRange } from '../common/dates';
import { type Paginated, pageArgs, toPage } from '../common/dto/pagination.dto';
import { conflict, ErrorCode } from '../common/errors/error-codes';
import { isUniqueViolation } from '../common/prisma-errors';
import type { Prisma } from '../generated/prisma/client';
import { CommissionStatus, LeadStatus, Role } from '../generated/prisma/enums';
import { formatLeadCode } from '../leads/lead-code';
import { PrismaService } from '../prisma/prisma.service';
import {
  CommissionJob,
  type CreateCommissionJobData,
  QueueName,
} from '../queues/queues';
import { calculateCommission } from './commission-calculator';
import { CommissionCreatedEvent, CommissionEvents } from './commission.events';
import { commissionInclude, toCommissionDto } from './commission.mapper';
import type {
  CommissionDto,
  CommissionSummaryDto,
  ListCommissionsQueryDto,
} from './dto/commission.dto';

export type CreateCommissionResult = 'created' | 'exists' | 'skipped';

/** One job per lead: BullMQ ignores a second add() with the same jobId. */
export const commissionJobId = (leadId: string) => `commission-${leadId}`;

const RECONCILE_BATCH = 500;

@Injectable()
export class CommissionsService {
  private readonly logger = new Logger(CommissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    @InjectQueue(QueueName.Commissions) private readonly queue: Queue,
  ) {}

  async enqueueForLead(leadId: string): Promise<void> {
    const data: CreateCommissionJobData = { leadId };
    await this.queue.add(CommissionJob.CreateForLead, data, {
      jobId: commissionJobId(leadId),
    });
  }

  /**
   * Job handler. Idempotent: running it twice for the same lead creates one
   * commission (checked first, and enforced by UNIQUE(lead_id) for races).
   */
  async createForLead(leadId: string): Promise<CreateCommissionResult> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        product: { select: { commissionType: true, commissionValue: true } },
        commission: { select: { id: true } },
      },
    });
    if (lead?.commission) {
      return 'exists';
    }
    if (
      !lead ||
      lead.status !== LeadStatus.DISBURSED ||
      lead.disbursedAmount === null
    ) {
      this.logger.warn(`Lead ${leadId} is not disbursed; no commission`);
      return 'skipped';
    }

    const amount = calculateCommission(lead.product, lead.disbursedAmount);
    let commissionId: string;
    try {
      const commission = await this.prisma.commission.create({
        data: { leadId, affiliateId: lead.affiliateId, amount },
        select: { id: true },
      });
      commissionId = commission.id;
    } catch (error) {
      if (isUniqueViolation(error, 'lead_id')) {
        return 'exists';
      }
      throw error;
    }

    this.events.emit(
      CommissionEvents.Created,
      new CommissionCreatedEvent(
        commissionId,
        lead.affiliateId,
        leadId,
        formatLeadCode(lead.number),
        Number(amount),
      ),
    );
    return 'created';
  }

  /**
   * Safety net for lost jobs (e.g. Redis was down right after a lead was
   * disbursed): finds disbursed leads without a commission and queues them.
   * A job that already failed for good is retried instead of re-added.
   */
  async reconcile(): Promise<number> {
    const leads = await this.prisma.lead.findMany({
      where: { status: LeadStatus.DISBURSED, commission: { is: null } },
      select: { id: true },
      take: RECONCILE_BATCH,
    });
    for (const { id } of leads) {
      const existing = await this.queue.getJob(commissionJobId(id));
      if (existing && (await existing.isFailed())) {
        await existing.retry();
      } else {
        await this.enqueueForLead(id);
      }
    }
    if (leads.length > 0) {
      this.logger.log(`Reconcile queued ${leads.length} missing commission(s)`);
    }
    return leads.length;
  }

  async list(
    query: ListCommissionsQueryDto,
    viewer: AuthUser,
  ): Promise<Paginated<CommissionDto>> {
    const where: Prisma.CommissionWhereInput = {
      affiliateId:
        viewer.role === Role.AFFILIATE ? viewer.id : query.affiliateId,
      status: query.status,
      ...(query.month && { createdAt: vnMonthRange(query.month) }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.commission.findMany({
        where,
        include: commissionInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.commission.count({ where }),
    ]);
    return toPage(items.map(toCommissionDto), total, query);
  }

  async summary(affiliateId: string): Promise<CommissionSummaryDto> {
    const [byStatus, totalLeads, disbursedLeads] = await Promise.all([
      this.prisma.commission.groupBy({
        by: ['status'],
        where: { affiliateId },
        _sum: { amount: true },
      }),
      this.prisma.lead.count({ where: { affiliateId } }),
      this.prisma.lead.count({
        where: { affiliateId, status: LeadStatus.DISBURSED },
      }),
    ]);
    const sum = (status: CommissionStatus) =>
      Number(byStatus.find((row) => row.status === status)?._sum.amount ?? 0n);
    return {
      pending: sum(CommissionStatus.PENDING),
      approved: sum(CommissionStatus.APPROVED),
      paid: sum(CommissionStatus.PAID),
      totalLeads,
      disbursedLeads,
    };
  }

  approve(id: string, actorId: string): Promise<CommissionDto> {
    return this.transition(id, actorId, {
      from: [CommissionStatus.PENDING],
      to: CommissionStatus.APPROVED,
      action: 'COMMISSION_APPROVED',
      error: 'Only PENDING commissions can be approved',
    });
  }

  cancel(id: string, reason: string, actorId: string): Promise<CommissionDto> {
    return this.transition(id, actorId, {
      from: [CommissionStatus.PENDING, CommissionStatus.APPROVED],
      to: CommissionStatus.CANCELLED,
      cancelReason: reason,
      action: 'COMMISSION_CANCELLED',
      error:
        'Only PENDING or APPROVED commissions that are not in a payout can be cancelled',
    });
  }

  /** Conditional update (same pattern as lead status): the WHERE is the rule. */
  private async transition(
    id: string,
    actorId: string,
    rule: {
      from: CommissionStatus[];
      to: CommissionStatus;
      cancelReason?: string;
      action: 'COMMISSION_APPROVED' | 'COMMISSION_CANCELLED';
      error: string;
    },
  ): Promise<CommissionDto> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.commission.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!current) {
        throw new NotFoundException('Commission not found');
      }
      const { count } = await tx.commission.updateMany({
        where: { id, status: { in: rule.from }, payoutId: null },
        data: {
          status: rule.to,
          ...(rule.cancelReason && { cancelReason: rule.cancelReason }),
        },
      });
      if (count !== 1) {
        throw conflict(
          ErrorCode.INVALID_COMMISSION_STATUS,
          `${rule.error} (current: ${current.status})`,
        );
      }
      await this.audit.record(
        {
          actorId,
          action: rule.action,
          entityType: 'Commission',
          entityId: id,
          before: { status: current.status },
          after: {
            status: rule.to,
            ...(rule.cancelReason && { reason: rule.cancelReason }),
          },
        },
        tx,
      );
      return tx.commission.findUniqueOrThrow({
        where: { id },
        include: commissionInclude,
      });
    });
    return toCommissionDto(updated);
  }
}
