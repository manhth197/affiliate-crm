import { X } from 'lucide-react'
import { type CSSProperties, useCallback } from 'react'
import { LEAD_STATUSES, type Product, type StaffMember } from '@/api/types'
import { SearchInput } from '@/components/search-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { LEAD_STATUS_LABELS } from '@/lib/labels'
import { useLeadFilters } from './use-lead-filters'

type LeadFiltersProps = {
  products: Product[]
  /** Back office: show the "assigned to" filter with these people. */
  staff?: StaffMember[]
  /** Kanban: every column is a status, so the status filter is hidden. */
  hideStatus?: boolean
}

export function LeadFilters({ products, staff, hideStatus = false }: LeadFiltersProps) {
  const { filters, hasFilters, update } = useLeadFilters()
  const onSearch = useCallback((q: string) => update({ q }), [update])
  // One row on large screens: search + one column per select/date + "clear".
  const columns = 4 + (staff ? 1 : 0) - (hideStatus ? 1 : 0)

  return (
    // Two columns on phones (search and "clear" take a full row), one row on large screens.
    <div
      className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,2fr)_repeat(var(--filter-columns),minmax(0,1fr))_auto]"
      style={{ '--filter-columns': columns } as CSSProperties}
    >
      <div className="col-span-2 lg:col-span-1">
        <SearchInput
          label="Tìm lead"
          placeholder="Tìm theo mã, tên khách hoặc SĐT"
          value={filters.q}
          onSearch={onSearch}
        />
      </div>
      {!hideStatus && (
        <NativeSelect
          aria-label="Trạng thái"
          className="w-full"
          value={filters.status}
          onChange={(event) => update({ status: event.target.value })}
        >
          <NativeSelectOption value="">Tất cả trạng thái</NativeSelectOption>
          {LEAD_STATUSES.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      {staff && (
        <NativeSelect
          aria-label="Phụ trách"
          className="w-full"
          value={filters.assignee}
          onChange={(event) => update({ assignee: event.target.value })}
        >
          <NativeSelectOption value="">Mọi người phụ trách</NativeSelectOption>
          <NativeSelectOption value="me">Của tôi</NativeSelectOption>
          <NativeSelectOption value="none">Chưa giao</NativeSelectOption>
          {staff.map((member) => (
            <NativeSelectOption key={member.id} value={member.id}>
              {member.fullName}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
      <NativeSelect
        aria-label="Sản phẩm"
        className="w-full"
        value={filters.productId}
        onChange={(event) => update({ productId: event.target.value })}
      >
        <NativeSelectOption value="">Tất cả sản phẩm</NativeSelectOption>
        {products.map((product) => (
          <NativeSelectOption key={product.id} value={product.id}>
            {product.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <DateFilter
        label="Từ"
        ariaLabel="Từ ngày"
        value={filters.fromDay}
        max={filters.toDay}
        onChange={(value) => update({ from: value })}
      />
      <DateFilter
        label="Đến"
        ariaLabel="Đến ngày"
        value={filters.toDay}
        min={filters.fromDay}
        onChange={(value) => update({ to: value })}
      />
      {hasFilters ? (
        <Button
          variant="ghost"
          className="col-span-2 lg:col-span-1"
          onClick={() =>
            update({ q: '', status: '', productId: '', assignee: '', from: '', to: '' })
          }
        >
          <X aria-hidden />
          Xóa lọc
        </Button>
      ) : (
        <span className="hidden lg:block" />
      )}
    </div>
  )
}

/** Native date input (the phone shows its own picker) with a visible short label inside. */
function DateFilter({
  label,
  ariaLabel,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  ariaLabel: string
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative">
      <span
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-muted-foreground"
        aria-hidden
      >
        {label}
      </span>
      <Input
        type="date"
        aria-label={ariaLabel}
        className="pl-10"
        value={value}
        min={min || undefined}
        max={max || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
