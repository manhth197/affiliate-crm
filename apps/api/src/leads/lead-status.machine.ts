import { LeadStatus } from '../generated/prisma/enums';

/**
 * Lead pipeline (docs/api-contract.md):
 *   NEW → CONTACTED → SUBMITTED → APPROVED → DISBURSED
 *   any open status → REJECTED
 * DISBURSED and REJECTED are final.
 */
const NEXT_STEP: Readonly<Record<LeadStatus, LeadStatus | null>> = {
  NEW: LeadStatus.CONTACTED,
  CONTACTED: LeadStatus.SUBMITTED,
  SUBMITTED: LeadStatus.APPROVED,
  APPROVED: LeadStatus.DISBURSED,
  DISBURSED: null,
  REJECTED: null,
};

export const OPEN_STATUSES: readonly LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.SUBMITTED,
  LeadStatus.APPROVED,
];

export function isOpen(status: LeadStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (to === LeadStatus.REJECTED) {
    return isOpen(from);
  }
  return NEXT_STEP[from] === to;
}

/** Statuses reachable from `from` in one step (for UI hints and error messages). */
export function allowedTransitions(from: LeadStatus): LeadStatus[] {
  return Object.values(LeadStatus).filter((to) => canTransition(from, to));
}
