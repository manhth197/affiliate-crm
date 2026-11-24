import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatNumber } from '@/lib/format'

type MoneyInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number | undefined
  onChange: (value: number | undefined) => void
}

/** Max 13 digits (< 10 000 tỷ): enough for any loan and safe as a JS number. */
const MAX_DIGITS = 13

/** VND amount input: shows "50.000.000" while typing, reports a whole number (or undefined). */
export function MoneyInput({ value, onChange, className, ...props }: MoneyInputProps) {
  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn('pr-8 tabular-nums', className)}
        value={value === undefined ? '' : formatNumber(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS)
          onChange(digits ? Number(digits) : undefined)
        }}
      />
      <span
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
        aria-hidden
      >
        ₫
      </span>
    </div>
  )
}
