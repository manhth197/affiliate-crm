import type { Prisma } from '../generated/prisma/client';
import { formatLeadCode } from '../leads/lead-code';
import type { CommissionDto } from './dto/commission.dto';

export const commissionInclude = {
  lead: { select: { id: true, number: true, customerName: true } },
  affiliate: { select: { id: true, fullName: true } },
} satisfies Prisma.CommissionInclude;

export type CommissionWithRelations = Prisma.CommissionGetPayload<{
  include: typeof commissionInclude;
}>;

export function toCommissionDto(c: CommissionWithRelations): CommissionDto {
  return {
    id: c.id,
    lead: {
      id: c.lead.id,
      code: formatLeadCode(c.lead.number),
      customerName: c.lead.customerName,
    },
    affiliate: { id: c.affiliate.id, fullName: c.affiliate.fullName },
    amount: Number(c.amount),
    status: c.status,
    payoutId: c.payoutId,
    createdAt: c.createdAt.toISOString(),
  };
}
