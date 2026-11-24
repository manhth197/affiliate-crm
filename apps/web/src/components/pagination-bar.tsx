import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'

type PaginationBarProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** What is being counted, e.g. "lead". */
  noun?: string
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  noun = 'mục',
}: PaginationBarProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row"
    >
      <p aria-live="polite">
        {total === 0
          ? `0 ${noun}`
          : `${formatNumber(first)}–${formatNumber(last)} trên ${formatNumber(total)} ${noun}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden />
          Trước
        </Button>
        <span className="min-w-20 text-center tabular-nums">
          Trang {page}/{pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Sau
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
