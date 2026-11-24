import { cn } from 'cn'
import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { formatNumber } from '@/lib/format'

type MoneyInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number | null | undefined
  /**
   * Empty input reports `null`, not `undefined`: react-hook-form treats `undefined` as
   * "not set" and would put the default value back.
   */
  onChange: (value: number | null) => void
}

/** Max 13 digits (< 10 000 tỷ): enough for any loan and safe as a JS number. */
const MAX_DIGITS = 13

/** VND amount input: shows "50.000.000" while typing, reports a whole number (or null). */
export function MoneyInput({ value, onChange, className, ...props }: MoneyInputProps) {
  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={cn('pr-8 tabular-nums', className)}
        value={value === null || value === undefined ? '' : formatNumber(value)}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS)
          onChange(digits ? Number(digits) : null)
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
