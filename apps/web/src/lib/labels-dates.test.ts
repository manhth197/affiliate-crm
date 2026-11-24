import { describe, expect, it } from 'vitest'
import { asText } from '@/test/text'
import { previousMonth, vnDay, vnDayRange, vnMonth } from './dates'
import { describeCommission } from './labels'

describe('describeCommission', () => {
  it('shows basis points as a percentage with decimals', () => {
    expect(describeCommission('PERCENT', 150)).toBe('1,5% số tiền giải ngân')
    expect(describeCommission('PERCENT', 100)).toBe('1% số tiền giải ngân')
    expect(describeCommission('PERCENT', 125)).toBe('1,25% số tiền giải ngân')
  })

  it('shows a fixed amount in VND', () => {
    expect(asText(describeCommission('FIXED', 300_000))).toBe('300.000 ₫ / hồ sơ thành công')
  })
})

describe('Vietnam calendar helpers', () => {
  it('turns inclusive Vietnam days into a half-open UTC range', () => {
    expect(vnDayRange('2026-11-01', '2026-11-30')).toEqual({
      from: '2026-10-31T17:00:00.000Z',
      to: '2026-11-30T17:00:00.000Z',
    })
    expect(vnDayRange(undefined, '2026-12-31')).toEqual({
      from: undefined,
      to: '2026-12-31T17:00:00.000Z',
    })
  })

  it('reads days and months in Vietnam time', () => {
    // 18:00 UTC on Nov 30 is already Dec 1 in Vietnam.
    expect(vnDay('2026-11-30T18:00:00.000Z')).toBe('2026-12-01')
    expect(vnMonth('2026-11-30T18:00:00.000Z')).toBe('2026-12')
  })

  it('steps back a month across the year boundary', () => {
    expect(previousMonth('2026-01')).toBe('2025-12')
    expect(previousMonth('2026-11')).toBe('2026-10')
  })
})
