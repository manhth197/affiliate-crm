import { addDays, format, parseISO } from 'date-fns'
import { previousMonth, vnDay, vnDayRange, vnMonth } from '@/lib/dates'

export const RANGE_PRESETS = {
  '7d': 'Hôm nay và 6 ngày trước',
  '30d': '30 ngày gần nhất',
  '90d': '90 ngày gần nhất',
  'this-month': 'Tháng này',
  'last-month': 'Tháng trước',
} as const
export type RangePreset = keyof typeof RANGE_PRESETS
export const DEFAULT_RANGE: RangePreset = '30d'

const shift = (day: string, days: number) => format(addDays(parseISO(day), days), 'yyyy-MM-dd')

/** First and last Vietnam calendar day (inclusive) of a preset, as of `now`. */
export function presetDays(preset: RangePreset, now = new Date()): { first: string; last: string } {
  const today = vnDay(now)
  switch (preset) {
    case '7d':
      return { first: shift(today, -6), last: today }
    case '30d':
      return { first: shift(today, -29), last: today }
    case '90d':
      return { first: shift(today, -89), last: today }
    case 'this-month':
      return { first: `${vnMonth(now)}-01`, last: today }
    case 'last-month': {
      const month = previousMonth(vnMonth(now))
      const nextFirst = `${vnMonth(now)}-01`
      return { first: `${month}-01`, last: shift(nextFirst, -1) }
    }
  }
}

/** The API's half-open ISO range for a preset. */
export function presetRange(preset: RangePreset, now = new Date()) {
  const { first, last } = presetDays(preset, now)
  return vnDayRange(first, last) as { from: string; to: string }
}
