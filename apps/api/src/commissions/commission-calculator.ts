import { CommissionType } from '../generated/prisma/enums';

export interface CommissionRule {
  commissionType: CommissionType;
  /** PERCENT: basis points (150 = 1.5%). FIXED: VND. */
  commissionValue: number;
}

const BASIS_POINTS_PER_UNIT = 10_000n;

/**
 * Commission in VND for a disbursed lead. Integer maths only (BigInt), so
 * there is no floating-point error; PERCENT rounds down to the đồng.
 *   PERCENT: floor(disbursedAmount × bps / 10000)
 *   FIXED:   commissionValue
 */
export function calculateCommission(
  rule: CommissionRule,
  disbursedAmount: bigint,
): bigint {
  if (disbursedAmount < 0n) {
    throw new RangeError('disbursedAmount must not be negative');
  }
  if (rule.commissionType === CommissionType.FIXED) {
    return BigInt(rule.commissionValue);
  }
  // For non-negative operands BigInt division truncates = rounds down.
  return (
    (disbursedAmount * BigInt(rule.commissionValue)) / BASIS_POINTS_PER_UNIT
  );
}
