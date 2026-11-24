import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import { LeadActivityType, LeadStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { formatLeadCode } from './lead-code';
import { LeadEvents, LeadStatusChangedEvent } from './lead.events';
import { leadInclude, type LeadWithRelations } from './lead.include';
import { allowedTransitions, canTransition } from './lead-status.machine';
import {
  conflict,
  ErrorCode,
  unprocessable,
} from '../common/errors/error-codes';

/** Who asked for the change: a logged-in staff member or a partner webhook. */
export type StatusChangeSource =
  | { kind: 'user'; userId: string }
  | { kind: 'partner'; partnerId: string; eventId: string };

export interface StatusChangeRequest {
  leadId: string;
  to: LeadStatus;
  note?: string;
  /** VND, required when `to` is DISBURSED. */
  disbursedAmount?: number;
  source: StatusChangeSource;
}

/**
 * The only place where a lead's status changes. Staff requests and partner
 * webhooks both come through here, so the rules, the activity entry, the
 * audit log and the domain event can never diverge between the two paths.
 */
@Injectable()
export class LeadStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async changeStatus(request: StatusChangeRequest): Promise<LeadWithRelations> {
    const { leadId, to, source } = request;
    if (to === LeadStatus.DISBURSED && request.disbursedAmount === undefined) {
      throw unprocessable(
        ErrorCode.DISBURSED_AMOUNT_REQUIRED,
        'disbursedAmount is required when status is DISBURSED',
      );
    }
    const actorId = source.kind === 'user' ? source.userId : null;

    const { lead, from } = await this.prisma.$transaction(async (tx) => {
      const current = await tx.lead.findUnique({
        where: { id: leadId },
        select: { status: true },
      });
      if (!current) {
        throw new NotFoundException('Lead not found');
      }
      if (!canTransition(current.status, to)) {
        throw conflict(
          ErrorCode.INVALID_TRANSITION,
          transitionError(current.status, to),
        );
      }

      // Optimistic concurrency: the update only applies if nobody changed the
      // status since we read it. Two staff clicking at once → one gets 409.
      const { count } = await tx.lead.updateMany({
        where: { id: leadId, status: current.status },
        data: {
          status: to,
          ...(to === LeadStatus.DISBURSED && {
            disbursedAmount: BigInt(request.disbursedAmount!),
          }),
        },
      });
      if (count !== 1) {
        throw conflict(
          ErrorCode.CONCURRENT_UPDATE,
          'The lead was changed by someone else. Reload and try again.',
        );
      }

      await tx.leadActivity.create({
        data: {
          leadId,
          type:
            source.kind === 'user'
              ? LeadActivityType.STATUS_CHANGED
              : LeadActivityType.WEBHOOK,
          fromStatus: current.status,
          toStatus: to,
          note: request.note ?? null,
          actorId,
        },
      });
      await this.audit.record(
        {
          actorId,
          action: 'LEAD_STATUS_CHANGED',
          entityType: 'Lead',
          entityId: leadId,
          before: { status: current.status },
          after: {
            status: to,
            ...(to === LeadStatus.DISBURSED && {
              disbursedAmount: request.disbursedAmount,
            }),
          },
          ...(source.kind === 'partner' && {
            metadata: { partnerId: source.partnerId, eventId: source.eventId },
          }),
        },
        tx,
      );
      const updated = await tx.lead.findUniqueOrThrow({
        where: { id: leadId },
        include: leadInclude,
      });
      return { lead: updated, from: current.status };
    });

    // Emitted only after COMMIT, so listeners never see a rolled-back change.
    this.events.emit(
      LeadEvents.StatusChanged,
      new LeadStatusChangedEvent(
        lead.id,
        formatLeadCode(lead.number),
        lead.affiliateId,
        from,
        to,
        actorId,
        lead.updatedAt,
      ),
    );
    return lead;
  }
}

function transitionError(from: LeadStatus, to: LeadStatus): string {
  const allowed = allowedTransitions(from);
  return allowed.length === 0
    ? `Cannot change status from ${from}: it is final`
    : `Cannot change status from ${from} to ${to}; allowed: ${allowed.join(', ')}`;
}
