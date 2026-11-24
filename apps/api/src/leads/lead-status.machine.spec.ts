import { LeadStatus } from '../generated/prisma/enums';
import {
  allowedTransitions,
  canTransition,
  isOpen,
} from './lead-status.machine';

const { NEW, CONTACTED, SUBMITTED, APPROVED, DISBURSED, REJECTED } = LeadStatus;
const ALL = Object.values(LeadStatus);

/** The full table from the contract; every other pair must be rejected. */
const ALLOWED: Array<[LeadStatus, LeadStatus]> = [
  [NEW, CONTACTED],
  [CONTACTED, SUBMITTED],
  [SUBMITTED, APPROVED],
  [APPROVED, DISBURSED],
  [NEW, REJECTED],
  [CONTACTED, REJECTED],
  [SUBMITTED, REJECTED],
  [APPROVED, REJECTED],
];

describe('lead status machine', () => {
  const allPairs = ALL.flatMap((from) =>
    ALL.map((to) => [from, to] as [LeadStatus, LeadStatus]),
  );

  it.each(allPairs)('%s → %s', (from, to) => {
    const expected = ALLOWED.some(([f, t]) => f === from && t === to);
    expect(canTransition(from, to)).toBe(expected);
  });

  it('has no self-transitions', () => {
    for (const status of ALL) {
      expect(canTransition(status, status)).toBe(false);
    }
  });

  it('treats DISBURSED and REJECTED as final', () => {
    expect(allowedTransitions(DISBURSED)).toEqual([]);
    expect(allowedTransitions(REJECTED)).toEqual([]);
    expect(isOpen(DISBURSED)).toBe(false);
    expect(isOpen(REJECTED)).toBe(false);
  });

  it('lists the next step and REJECTED for open statuses', () => {
    expect(allowedTransitions(NEW)).toEqual([CONTACTED, REJECTED]);
    expect(allowedTransitions(APPROVED)).toEqual([DISBURSED, REJECTED]);
  });
});
