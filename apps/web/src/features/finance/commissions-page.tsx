import { cn } from 'cn'
import { Link } from 'react-router'
import type { CommissionStatus } from '@/api/types'
import { useCurrentUser } from '@/auth/auth-context'
import { EmptyState, QueryErrorAlert } from '@/components/feedback'
import { MonthSelect } from '@/components/month-select'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { CommissionStatusBadge } from '@/components/status-badge'
import { Card } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, formatDateTime, formatVnd } from '@/lib/format'
import { COMMISSION_STATUS_LABELS } from '@/lib/labels'
import { useUrlState } from '@/lib/use-url-state'
import { CommissionSummaryCards } from './commission-summary-cards'
import { useCommissions } from './queries'

const PAGE_SIZE = 20
const STATUSES = Object.keys(COMMISSION_STATUS_LABELS) as CommissionStatus[]

export function CommissionsPage() {
  const user = useCurrentUser()
  const isAffiliate = user.role === 'AFFILIATE'
  const url = useUrlState()
  const status = STATUSES.find((s) => s === url.get('status'))
  const month = /^\d{4}-\d{2}$/.test(url.get('month')) ? url.get('month') : undefined
  const commissions = useCommissions({ status, month, page: url.page, pageSize: PAGE_SIZE })

  return (
    <>
      <PageHeader
        title="Hoa hồng"
        description={
          isAffiliate
            ? 'Hoa hồng được tạo tự động khi khoản vay/hồ sơ của khách giải ngân thành công.'
            : 'Hoa hồng của tất cả cộng tác viên.'
        }
      />
      <div className="space-y-4">
        {isAffiliate && <CommissionSummaryCards />}

        <div className="flex flex-col gap-2 sm:flex-row">
          <NativeSelect
            aria-label="Trạng thái"
            className="w-full sm:w-44"
            value={status ?? ''}
            onChange={(event) => url.update({ status: event.target.value })}
          >
            <NativeSelectOption value="">Tất cả trạng thái</NativeSelectOption>
            {STATUSES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {COMMISSION_STATUS_LABELS[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <MonthSelect value={month ?? ''} onChange={(value) => url.update({ month: value })} />
        </div>

        {commissions.isError ? (
          <QueryErrorAlert error={commissions.error} onRetry={() => void commissions.refetch()} />
        ) : (
          <Card className={cn('py-0', commissions.isPlaceholderData && 'opacity-60')}>
            {commissions.isPending ? (
              <div className="space-y-3 p-4" aria-busy="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : commissions.data.data.length === 0 ? (
              <EmptyState
                title="Chưa có hoa hồng"
                description={
                  status || month
                    ? 'Không có hoa hồng nào khớp bộ lọc.'
                    : 'Khi lead của bạn được giải ngân, hoa hồng sẽ xuất hiện ở đây.'
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Lead</TableHead>
                    {!isAffiliate && <TableHead>Cộng tác viên</TableHead>}
                    <TableHead className="text-right">Số tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="hidden pr-4 sm:table-cell">Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.data.data.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="pl-4">
                        <Link
                          to={`/leads/${commission.lead.id}`}
                          className="font-medium hover:underline"
                        >
                          {commission.lead.code}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {commission.lead.customerName}
                        </div>
                      </TableCell>
                      {!isAffiliate && <TableCell>{commission.affiliate.fullName}</TableCell>}
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatVnd(commission.amount)}
                      </TableCell>
                      <TableCell>
                        <CommissionStatusBadge status={commission.status} />
                      </TableCell>
                      <TableCell
                        className="hidden pr-4 text-muted-foreground tabular-nums sm:table-cell"
                        title={formatDateTime(commission.createdAt)}
                      >
                        {formatDate(commission.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}

        {commissions.data && commissions.data.meta.total > 0 && (
          <PaginationBar
            page={url.page}
            pageSize={PAGE_SIZE}
            total={commissions.data.meta.total}
            onPageChange={(page) => url.update({ page })}
            noun="khoản hoa hồng"
          />
        )}
      </div>
    </>
  )
}
