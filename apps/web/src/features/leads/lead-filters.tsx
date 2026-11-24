import { X } from 'lucide-react'
import { useCallback } from 'react'
import { LEAD_STATUSES, type Product } from '@/api/types'
import { SearchInput } from '@/components/search-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { LEAD_STATUS_LABELS } from '@/lib/labels'
import { useLeadFilters } from './use-lead-filters'

type LeadFiltersProps = {
  products: Product[]
}

export function LeadFilters({ products }: LeadFiltersProps) {
  const { filters, hasFilters, update } = useLeadFilters()
  const onSearch = useCallback((q: string) => update({ q }), [update])

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
      <SearchInput
        label="Tìm lead"
        placeholder="Tìm theo mã, tên khách hoặc SĐT"
        value={filters.q}
        onSearch={onSearch}
      />
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
      <Input
        type="date"
        aria-label="Từ ngày"
        title="Từ ngày"
        value={filters.fromDay}
        max={filters.toDay || undefined}
        onChange={(event) => update({ from: event.target.value })}
      />
      <Input
        type="date"
        aria-label="Đến ngày"
        title="Đến ngày"
        value={filters.toDay}
        min={filters.fromDay || undefined}
        onChange={(event) => update({ to: event.target.value })}
      />
      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => update({ q: '', status: '', productId: '', from: '', to: '' })}
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
