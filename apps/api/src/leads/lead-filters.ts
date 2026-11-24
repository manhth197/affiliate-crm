import type { AuthUser } from '../auth/auth.types';
import { dateRange } from '../common/dates';
import { toSearchText } from '../common/search-text';
import type { Prisma } from '../generated/prisma/client';
import { Role } from '../generated/prisma/enums';
import type { LeadFiltersDto } from './dto/list-leads-query.dto';
import { parseLeadCode } from './lead-code';

export const LEAD_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'requestedAmount',
  'disbursedAmount',
] as const;
export const LEAD_SORT_PATTERN = new RegExp(
  `^(${LEAD_SORT_FIELDS.join('|')}):(asc|desc)$`,
);
export const DEFAULT_LEAD_SORT = 'createdAt:desc';
/** `assignedStaffId=none` selects leads nobody has been assigned. */
export const UNASSIGNED = 'none';

/**
 * Builds the Prisma filter for GET /leads and the CSV export.
 * Row-level security lives here: an affiliate is always limited to their own
 * leads, whatever `affiliateId` they send.
 */
export function buildLeadWhere(
  filters: LeadFiltersDto,
  viewer: AuthUser,
): Prisma.LeadWhereInput {
  return {
    affiliateId:
      viewer.role === Role.AFFILIATE ? viewer.id : filters.affiliateId,
    status: filters.status,
    productId: filters.productId,
    assignedStaffId:
      filters.assignedStaffId === UNASSIGNED ? null : filters.assignedStaffId,
    createdAt: dateRange(filters.from, filters.to),
    ...(filters.q ? { OR: searchConditions(filters.q) } : {}),
  };
}

/** `q` matches the customer name, the lead code or (part of) the phone number. */
function searchConditions(q: string): Prisma.LeadWhereInput[] {
  const conditions: Prisma.LeadWhereInput[] = [
    { customerNameSearch: { contains: toSearchText(q) } },
  ];
  const leadNumber = parseLeadCode(q);
  if (leadNumber !== null) {
    conditions.push({ number: leadNumber });
  }
  const compact = q.replace(/[\s.\-()]/g, '').replace(/^\+84/, '0');
  if (/^\d{3,}$/.test(compact)) {
    conditions.push({ customerPhone: { contains: compact } });
  }
  return conditions;
}

/** "requestedAmount:desc" → ORDER BY requested_amount DESC NULLS LAST, id DESC. */
export function buildLeadOrderBy(
  sort: string = DEFAULT_LEAD_SORT,
): Prisma.LeadOrderByWithRelationInput[] {
  const [field, direction] = sort.split(':') as [
    (typeof LEAD_SORT_FIELDS)[number],
    'asc' | 'desc',
  ];
  const primary: Prisma.LeadOrderByWithRelationInput =
    field === 'requestedAmount' || field === 'disbursedAmount'
      ? { [field]: { sort: direction, nulls: 'last' } }
      : { [field]: direction };
  // Tie-breaker keeps pagination stable when many rows share the same value.
  return [primary, { id: direction }];
}
