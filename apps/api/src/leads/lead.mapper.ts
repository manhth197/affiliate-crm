import type { AuthUser } from '../auth/auth.types';
import { maskNationalId, maskPhone } from '../common/masking';
import { Role } from '../generated/prisma/enums';
import type { LeadActivityDto, LeadDto } from './dto/lead.dto';
import { formatLeadCode } from './lead-code';
import type { ActivityWithActor, LeadWithRelations } from './lead.include';

/** BIGINT VND → JSON number (exact up to 9·10^15, far above any real amount). */
export function toMoney(value: bigint | null): number | null {
  return value === null ? null : Number(value);
}

/**
 * Maps a lead for a given viewer. Customer PII is masked here, at
 * serialization, so no code path can forget to mask it for affiliates.
 */
export function toLeadDto(lead: LeadWithRelations, viewer: AuthUser): LeadDto {
  const masked = viewer.role === Role.AFFILIATE;
  return {
    id: lead.id,
    code: formatLeadCode(lead.number),
    affiliate: {
      id: lead.affiliate.id,
      fullName: lead.affiliate.fullName,
      referralCode: lead.affiliate.affiliateProfile?.referralCode ?? '',
    },
    product: {
      id: lead.product.id,
      name: lead.product.name,
      partnerName: lead.product.partnerName,
    },
    customerName: lead.customerName,
    customerPhone: masked ? maskPhone(lead.customerPhone) : lead.customerPhone,
    customerNationalId:
      lead.customerNationalId === null
        ? null
        : masked
          ? maskNationalId(lead.customerNationalId)
          : lead.customerNationalId,
    requestedAmount: toMoney(lead.requestedAmount),
    disbursedAmount: toMoney(lead.disbursedAmount),
    status: lead.status,
    assignedStaff: lead.assignedStaff
      ? { id: lead.assignedStaff.id, fullName: lead.assignedStaff.fullName }
      : null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

export function toLeadActivityDto(
  activity: ActivityWithActor,
): LeadActivityDto {
  return {
    id: activity.id,
    leadId: activity.leadId,
    type: activity.type,
    fromStatus: activity.fromStatus,
    toStatus: activity.toStatus,
    note: activity.note,
    actor: activity.actor
      ? { id: activity.actor.id, fullName: activity.actor.fullName }
      : null,
    createdAt: activity.createdAt.toISOString(),
  };
}
