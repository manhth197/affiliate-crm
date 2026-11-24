import { generateReferralCode, REFERRAL_CODE_PATTERN } from './referral-code';

describe('generateReferralCode', () => {
  it('returns CTV + 6 characters from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateReferralCode()).toMatch(REFERRAL_CODE_PATTERN);
    }
  });

  it('never uses 0, O, 1 or I after the prefix', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateReferralCode().slice(3)).not.toMatch(/[0O1I]/);
    }
  });

  it('is driven by the injected random source', () => {
    expect(generateReferralCode(() => 0)).toBe('CTVAAAAAA');
    expect(generateReferralCode((max) => max - 1)).toBe('CTV999999');
  });
});
