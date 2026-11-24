import { CommissionType } from '../generated/prisma/enums';

/** 10000 basis points = 100%. */
export const MAX_PERCENT_BASIS_POINTS = 10_000;
/** Upper bound for a fixed commission per lead: 1 billion VND. */
export const MAX_FIXED_COMMISSION_VND = 1_000_000_000;

/**
 * Validates a product's commission rule as a whole (type and value depend on
 * each other, so a PATCH that changes only one of them is checked against the
 * merged result). Returns an error message for `commissionValue`, or null.
 */
export function commissionRuleError(
  type: CommissionType,
  value: number,
): string | null {
  if (!Number.isInteger(value) || value < 0) {
    return 'must be a non-negative integer';
  }
  if (type === CommissionType.PERCENT && value > MAX_PERCENT_BASIS_POINTS) {
    return `must be at most ${MAX_PERCENT_BASIS_POINTS} basis points (100%) for PERCENT`;
  }
  if (type === CommissionType.FIXED && value > MAX_FIXED_COMMISSION_VND) {
    return `must be at most ${MAX_FIXED_COMMISSION_VND} VND for FIXED`;
  }
  return null;
}
