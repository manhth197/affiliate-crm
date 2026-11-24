import {
  dateRange,
  ISO_DATETIME_PATTERN,
  vnDate,
  vnMonth,
  vnMonthRange,
} from './dates';

describe('dates', () => {
  describe('ISO_DATETIME_PATTERN', () => {
    it.each([
      '2026-11-24T00:00:00+07:00',
      '2026-11-23T17:00:00Z',
      '2026-11-23T17:00:00.123Z',
      '2026-11-23T17:00Z',
    ])('accepts %s', (value) => {
      expect(ISO_DATETIME_PATTERN.test(value)).toBe(true);
    });

    it.each(['2026-11-24', '2026-11-24T00:00:00', '24/11/2026', 'yesterday'])(
      'rejects %s (no timezone or not ISO)',
      (value) => {
        expect(ISO_DATETIME_PATTERN.test(value)).toBe(false);
      },
    );
  });

  describe('dateRange', () => {
    it('is half-open: from inclusive (gte), to exclusive (lt)', () => {
      expect(
        dateRange('2026-11-01T00:00:00+07:00', '2026-12-01T00:00:00+07:00'),
      ).toEqual({
        gte: new Date('2026-10-31T17:00:00Z'),
        lt: new Date('2026-11-30T17:00:00Z'),
      });
    });

    it('supports open-ended ranges', () => {
      expect(dateRange(undefined, '2026-12-01T00:00:00Z')).toEqual({
        lt: new Date('2026-12-01T00:00:00Z'),
      });
      expect(dateRange()).toBeUndefined();
    });
  });

  describe('Vietnam calendar', () => {
    it('vnMonthRange starts and ends at midnight Vietnam time', () => {
      expect(vnMonthRange('2026-11')).toEqual({
        gte: new Date('2026-10-31T17:00:00Z'),
        lt: new Date('2026-11-30T17:00:00Z'),
      });
    });

    it('vnMonthRange handles December → January', () => {
      expect(vnMonthRange('2026-12').lt).toEqual(
        new Date('2026-12-31T17:00:00Z'),
      );
    });

    it('vnDate/vnMonth use +07:00, so 17:00Z is already the next day', () => {
      expect(vnDate(new Date('2026-11-30T16:59:59Z'))).toBe('2026-11-30');
      expect(vnDate(new Date('2026-11-30T17:00:00Z'))).toBe('2026-12-01');
      expect(vnMonth(new Date('2026-11-30T17:00:00Z'))).toBe('2026-12');
    });
  });
});
