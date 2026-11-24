import type { Prisma } from '../generated/prisma/client';

/** Relations needed to render a Lead in the API shape. */
export const leadInclude = {
  affiliate: {
    select: {
      id: true,
      fullName: true,
      affiliateProfile: { select: { referralCode: true } },
    },
  },
  product: { select: { id: true, name: true, partnerName: true } },
  assignedStaff: { select: { id: true, fullName: true } },
} satisfies Prisma.LeadInclude;

export type LeadWithRelations = Prisma.LeadGetPayload<{
  include: typeof leadInclude;
}>;

export const activityInclude = {
  actor: { select: { id: true, fullName: true } },
  assignee: { select: { id: true, fullName: true } },
} satisfies Prisma.LeadActivityInclude;

export type ActivityWithActor = Prisma.LeadActivityGetPayload<{
  include: typeof activityInclude;
}>;
