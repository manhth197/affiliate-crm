import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime, formatPercent, formatVnd, getInitials, NBSP } from './format'

describe('formatVnd', () => {
  it('uses dots as thousand separators and the ₫ symbol', () => {
    expect(formatVnd(1_500_000)).toBe(`1.500.000${NBSP}₫`)
    expect(formatVnd(0)).toBe(`0${NBSP}₫`)
  })

  it('shows a dash for missing amounts', () => {
    expect(formatVnd(null)).toBe('—')
    expect(formatVnd(undefined)).toBe('—')
  })
})

describe('dates in Vietnam time (UTC+7)', () => {
  it('converts UTC to Asia/Ho_Chi_Minh regardless of the machine time zone', () => {
    // 17:30 UTC on the 24th is 00:30 on the 25th in Vietnam.
    expect(formatDateTime('2026-11-24T17:30:00.000Z')).toBe('25/11/2026 00:30')
    expect(formatDate('2026-11-24T17:30:00.000Z')).toBe('25/11/2026')
  })
})

describe('formatPercent', () => {
  it('formats a 0..1 ratio with Vietnamese decimals', () => {
    expect(formatPercent(0.1234)).toBe('12,3%')
  })
})

describe('getInitials', () => {
  it('takes the first letters of the first and last words', () => {
    expect(getInitials('Nguyễn Văn An')).toBe('NA')
    expect(getInitials('  lê  ')).toBe('L')
    expect(getInitials('')).toBe('?')
  })
})
