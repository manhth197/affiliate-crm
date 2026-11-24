import { maskBankAccount, maskNationalId, maskPhone } from './masking';

describe('masking', () => {
  describe('maskPhone', () => {
    it('keeps the first 2 and last 2 digits', () => {
      expect(maskPhone('0912345689')).toBe('09******89');
    });

    it('preserves length', () => {
      expect(maskPhone('0912345689')).toHaveLength(10);
    });

    it('masks everything when the value is too short to hide anything', () => {
      expect(maskPhone('0912')).toBe('****');
      expect(maskPhone('')).toBe('');
    });
  });

  describe('maskNationalId', () => {
    it('keeps only the last 3 digits of a 12-digit CCCD', () => {
      expect(maskNationalId('001203004123')).toBe('*********123');
    });

    it('works for the old 9-digit CMND', () => {
      expect(maskNationalId('123456789')).toBe('******789');
    });
  });

  describe('maskBankAccount', () => {
    it('keeps the last 4 digits', () => {
      expect(maskBankAccount('0123456789')).toBe('******6789');
    });
  });
});
