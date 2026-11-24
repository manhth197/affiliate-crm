import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { previousMonth, vnMonth } from '@/lib/dates'
import { formatMonth } from '@/lib/format'

/** The current Vietnam month and the 11 before it, newest first ("YYYY-MM"). */
function recentMonths(count = 12, now = new Date()): string[] {
  const months = [vnMonth(now)]
  while (months.length < count) months.push(previousMonth(months.at(-1)!))
  return months
}

/**
 * Month filter as a select (not `<input type="month">`, which some desktop browsers render as
 * a plain text box).
 */
export function MonthSelect({
  value,
  onChange,
  label = 'Tháng',
}: {
  value: string
  onChange: (month: string) => void
  label?: string
}) {
  return (
    <NativeSelect
      aria-label={label}
      className="w-full sm:w-44"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <NativeSelectOption value="">Tất cả các tháng</NativeSelectOption>
      {recentMonths().map((month) => (
        <NativeSelectOption key={month} value={month}>
          {formatMonth(month)}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
