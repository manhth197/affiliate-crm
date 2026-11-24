import { CommissionType } from '../generated/prisma/enums';
import { commissionRuleError } from './commission-rule';

describe('commissionRuleError', () => {
  it.each([
    [CommissionType.PERCENT, 0],
    [CommissionType.PERCENT, 150], // 1.5%
    [CommissionType.PERCENT, 10_000], // 100%
    [CommissionType.FIXED, 0],
    [CommissionType.FIXED, 500_000],
    [CommissionType.FIXED, 1_000_000_000],
  ])('accepts %s %d', (type, value) => {
    expect(commissionRuleError(type, value)).toBeNull();
  });

  it('rejects more than 100% for PERCENT', () => {
    expect(commissionRuleError(CommissionType.PERCENT, 10_001)).toMatch(
      /10000 basis points/,
    );
  });

  it('allows large VND values for FIXED that would be invalid as a percentage', () => {
    expect(commissionRuleError(CommissionType.FIXED, 200_000)).toBeNull();
    expect(commissionRuleError(CommissionType.PERCENT, 200_000)).not.toBeNull();
  });

  it('rejects negative, fractional and oversized values', () => {
    expect(commissionRuleError(CommissionType.FIXED, -1)).not.toBeNull();
    expect(commissionRuleError(CommissionType.PERCENT, 1.5)).not.toBeNull();
    expect(
      commissionRuleError(CommissionType.FIXED, 1_000_000_001),
    ).not.toBeNull();
  });
});
