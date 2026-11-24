import { BadRequestException } from '@nestjs/common';
import { fillDays, resolveReportRange } from './report-range';

describe('resolveReportRange', () => {
  const now = new Date('2026-11-24T05:00:00Z'); // 12:00 in Vietnam

  it('defaults to the last 30 Vietnam calendar days up to now', () => {
    expect(resolveReportRange(undefined, undefined, now)).toEqual({
      from: new Date('2026-10-25T17:00:00Z'), // 2026-10-26 00:00 +07:00
      to: now,
    });
  });

  it('uses the given half-open bounds', () => {
    expect(
      resolveReportRange(
        '2026-11-01T00:00:00+07:00',
        '2026-12-01T00:00:00+07:00',
      ),
    ).toEqual({
      from: new Date('2026-10-31T17:00:00Z'),
      to: new Date('2026-11-30T17:00:00Z'),
    });
  });

  it('rejects from >= to and ranges over 366 days', () => {
    expect(() =>
      resolveReportRange('2026-11-02T00:00:00Z', '2026-11-01T00:00:00Z'),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveReportRange('2024-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
    ).toThrow(BadRequestException);
  });
});

describe('fillDays', () => {
  it('returns every Vietnam day in [from, to) with zeros for gaps', () => {
    const range = {
      from: new Date('2026-11-01T00:00:00+07:00'),
      to: new Date('2026-11-04T00:00:00+07:00'),
    };
    expect(fillDays(range, [{ date: '2026-11-02', count: 5 }])).toEqual([
      { date: '2026-11-01', count: 0 },
      { date: '2026-11-02', count: 5 },
      { date: '2026-11-03', count: 0 },
    ]);
  });

  it('includes partial first and last days', () => {
    const range = {
      from: new Date('2026-11-01T20:00:00+07:00'),
      to: new Date('2026-11-02T08:00:00+07:00'),
    };
    expect(fillDays(range, []).map((d) => d.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('treats 17:00Z as the next Vietnam day', () => {
    const range = {
      from: new Date('2026-11-30T17:00:00Z'),
      to: new Date('2026-11-30T18:00:00Z'),
    };
    expect(fillDays(range, [])).toEqual([{ date: '2026-12-01', count: 0 }]);
  });
});
