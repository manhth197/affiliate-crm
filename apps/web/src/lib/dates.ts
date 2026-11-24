import { tz } from '@date-fns/tz'
import { addDays, format, parseISO } from 'date-fns'

/**
 * Vietnam calendar helpers. Vietnam is UTC+7 all year (no daylight saving), and the API
 * contract says: date filters are ISO datetimes, half-open [from, to), and months / per-day
 * buckets follow the Asia/Ho_Chi_Minh calendar.
 */
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const VN_OFFSET = '+07:00'
const inVietnam = tz(VN_TIME_ZONE)

/** "2026-11-24" → ISO instant of 00:00 that day in Vietnam ("2026-11-23T17:00:00.000Z"). */
export function vnDayStart(day: string): string {
  return new Date(`${day}T00:00:00${VN_OFFSET}`).toISOString()
}

/**
 * Inclusive Vietnam calendar days (as picked in a date input) → the API's half-open range.
 * `to` becomes 00:00 of the next day, so the whole last day is included.
 */
export function vnDayRange(fromDay?: string, toDay?: string): { from?: string; to?: string } {
  return {
    from: fromDay ? vnDayStart(fromDay) : undefined,
    to: toDay ? vnDayStart(format(addDays(parseISO(toDay), 1), 'yyyy-MM-dd')) : undefined,
  }
}

/** ISO instant → "YYYY-MM-DD" of that moment in Vietnam. */
export function vnDay(iso: string | Date): string {
  return format(new Date(iso), 'yyyy-MM-dd', { in: inVietnam })
}

/** ISO instant → "YYYY-MM" of that moment in Vietnam. */
export function vnMonth(iso: string | Date): string {
  return format(new Date(iso), 'yyyy-MM', { in: inVietnam })
}

/** "2026-11" → "2026-10" */
export function previousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number) as [number, number]
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`
}
