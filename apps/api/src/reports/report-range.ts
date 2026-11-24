import { BadRequestException } from '@nestjs/common';
import { VN_OFFSET_MS, vnDate } from '../common/dates';

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReportRange {
  /** Inclusive */
  from: Date;
  /** Exclusive */
  to: Date;
}

/** Start of the Vietnam calendar day containing `instant`. */
function startOfVnDay(instant: Date): Date {
  const shifted = instant.getTime() + VN_OFFSET_MS;
  return new Date(shifted - (shifted % DAY_MS) - VN_OFFSET_MS);
}

/**
 * Resolves the [from, to) range of a report. Defaults: `to` = now, and `from`
 * = start of the Vietnam day 29 days earlier (30 calendar days incl. today).
 */
export function resolveReportRange(
  from?: string,
  to?: string,
  now: Date = new Date(),
): ReportRange {
  const end = to ? new Date(to) : now;
  const start = from
    ? new Date(from)
    : startOfVnDay(new Date(end.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS));
  if (start >= end) {
    throw invalid('from', 'must be before to');
  }
  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw invalid('to', `range must not exceed ${MAX_RANGE_DAYS} days`);
  }
  return { from: start, to: end };
}

function invalid(field: string, message: string): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    details: [{ field, message }],
  });
}

/**
 * One entry per Vietnam calendar day touched by [from, to), with 0 for days
 * that have no rows, so charts get a continuous x-axis.
 */
export function fillDays(
  range: ReportRange,
  rows: { date: string; count: number }[],
): { date: string; count: number }[] {
  const counts = new Map(rows.map((r) => [r.date, r.count]));
  const lastDay = vnDate(new Date(range.to.getTime() - 1));
  const days: { date: string; count: number }[] = [];
  for (
    let cursor = startOfVnDay(range.from);
    ;
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const date = vnDate(cursor);
    days.push({ date, count: counts.get(date) ?? 0 });
    if (date >= lastDay) {
      return days;
    }
  }
}
