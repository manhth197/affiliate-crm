import { applyDecorators } from '@nestjs/common';
import { Matches } from 'class-validator';

/**
 * Date rules from the contract (v0.2):
 * - `from` / `to` are ISO 8601 datetimes with `Z` or an offset; the range is
 *   half-open [from, to).
 * - `month=YYYY-MM` and per-day buckets use the Asia/Ho_Chi_Minh calendar.
 *   Vietnam has no DST, so the offset is always +07:00.
 */
export const VN_UTC_OFFSET = '+07:00';
export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "2026-11-24T00:00:00+07:00", "2026-11-23T17:00:00.000Z", … (seconds optional). */
export const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Query decorator: ISO datetime that includes a timezone (Z or ±hh:mm). */
export function IsIsoDateTime(): PropertyDecorator {
  return applyDecorators(
    Matches(ISO_DATETIME_PATTERN, {
      message:
        'must be an ISO 8601 datetime with a timezone, e.g. 2026-11-24T00:00:00+07:00',
    }),
  );
}

export function IsMonth(): PropertyDecorator {
  return applyDecorators(
    Matches(MONTH_PATTERN, { message: 'must be a month in YYYY-MM format' }),
  );
}

export interface DateRange {
  gte?: Date;
  lt?: Date;
}

/** Prisma filter for a half-open [from, to) range; undefined when neither is set. */
export function dateRange(from?: string, to?: string): DateRange | undefined {
  if (!from && !to) {
    return undefined;
  }
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lt: new Date(to) } : {}),
  };
}

/** "2026-11" → [2026-10-31T17:00:00Z, 2026-11-30T17:00:00Z): the month in Vietnam time. */
export function vnMonthRange(month: string): { gte: Date; lt: Date } {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = Date.UTC(year, monthIndex - 1, 1) - VN_OFFSET_MS;
  const end = Date.UTC(year, monthIndex, 1) - VN_OFFSET_MS;
  return { gte: new Date(start), lt: new Date(end) };
}

/** The Vietnam calendar day of an instant, as "YYYY-MM-DD". */
export function vnDate(instant: Date): string {
  return new Date(instant.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** "2026-11-24 15:30" in Vietnam time (for files people read, e.g. CSV). */
export function formatVnDateTime(instant: Date): string {
  const shifted = new Date(instant.getTime() + VN_OFFSET_MS).toISOString();
  return `${shifted.slice(0, 10)} ${shifted.slice(11, 16)}`;
}

/** The Vietnam calendar month of an instant, as "YYYY-MM". */
export function vnMonth(instant: Date): string {
  return vnDate(instant).slice(0, 7);
}
