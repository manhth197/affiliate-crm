import { CommissionType } from '../generated/prisma/enums';
import { calculateCommission } from './commission-calculator';

const percent = (bps: number) => ({
  commissionType: CommissionType.PERCENT,
  commissionValue: bps,
});

describe('calculateCommission', () => {
  it('applies basis points: 1.5% of 50,000,000 = 750,000', () => {
    expect(calculateCommission(percent(150), 50_000_000n)).toBe(750_000n);
  });

  it('rounds down to the đồng', () => {
    // 33,333,333 × 1.5% = 499,999.995
    expect(calculateCommission(percent(150), 33_333_333n)).toBe(499_999n);
    // 1 × 99.99% = 0.9999
    expect(calculateCommission(percent(9_999), 1n)).toBe(0n);
  });

  it('handles 0% and 100%', () => {
    expect(calculateCommission(percent(0), 10_000_000n)).toBe(0n);
    expect(calculateCommission(percent(10_000), 10_000_000n)).toBe(10_000_000n);
  });

  it('stays exact for amounts beyond Number.MAX_SAFE_INTEGER', () => {
    const huge = 90_071_992_547_409_930n; // > 2^53
    expect(calculateCommission(percent(1), huge)).toBe(9_007_199_254_740n);
  });

  it('uses the fixed amount regardless of the disbursed amount', () => {
    const fixed = {
      commissionType: CommissionType.FIXED,
      commissionValue: 500_000,
    };
    expect(calculateCommission(fixed, 0n)).toBe(500_000n);
    expect(calculateCommission(fixed, 999_000_000n)).toBe(500_000n);
  });

  it('rejects a negative amount', () => {
    expect(() => calculateCommission(percent(150), -1n)).toThrow(RangeError);
  });
});
