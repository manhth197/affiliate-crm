import { cn } from 'cn'
import { Landmark } from 'lucide-react'
import type { PayoutStatus } from '@/api/types'
import { useCurrentUser } from '@/auth/auth-context'
import { EmptyState, QueryErrorAlert } from '@/components/feedback'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { PayoutStatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { formatDate, formatMonth, formatNumber, formatVnd } from '@/lib/format'
import { PAYOUT_STATUS_LABELS } from '@/lib/labels'
import { useUrlState } from '@/lib/use-url-state'
import { usePayouts } from './queries'

const PAGE_SIZE = 20
const STATUSES = Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[]

export function PayoutsPage() {
  const user = useCurrentUser()
  const isAffiliate = user.role === 'AFFILIATE'
  const url = useUrlState()
  const status = STATUSES.find((s) => s === url.get('status'))
  const payouts = usePayouts({ status, page: url.page, pageSize: PAGE_SIZE })

  return (
    <>
      <PageHeader
        title="Chi trả"
        description="Hoa hồng đã duyệt được tổng hợp theo tháng và chuyển khoản cho cộng tác viên."
      />
      <div className="space-y-4">
        {user.affiliate && (
          <Alert>
            <Landmark aria-hidden />
            <AlertTitle>Tài khoản nhận tiền</AlertTitle>
            <AlertDescription>
              {user.affiliate.bankName && user.affiliate.bankAccountMasked
                ? `${user.affiliate.bankName} · ${user.affiliate.bankAccountMasked}`
                : 'Bạn chưa có thông tin tài khoản ngân hàng. Vui lòng liên hệ quản trị viên để được chi trả.'}
            </AlertDescription>
          </Alert>
        )}

        <NativeSelect
          aria-label="Trạng thái"
          className="w-full sm:w-44"
          value={status ?? ''}
          onChange={(event) => url.update({ status: event.target.value })}
        >
          <NativeSelectOption value="">Tất cả trạng thái</NativeSelectOption>
          {STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {PAYOUT_STATUS_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        {payouts.isError ? (
          <QueryErrorAlert error={payouts.error} onRetry={() => void payouts.refetch()} />
        ) : (
          <Card className={cn('py-0', payouts.isPlaceholderData && 'opacity-60')}>
            {payouts.isPending ? (
              <div className="space-y-3 p-4" aria-busy="true">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : payouts.data.data.length === 0 ? (
              <EmptyState
                title="Chưa có kỳ chi trả"
                description="Kỳ chi trả được tạo vào đầu mỗi tháng từ các khoản hoa hồng đã duyệt."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Kỳ</TableHead>
                    {!isAffiliate && <TableHead>Cộng tác viên</TableHead>}
                    <TableHead className="hidden text-right sm:table-cell">Số khoản</TableHead>
                    <TableHead className="text-right">Tổng tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="hidden pr-4 sm:table-cell">Ngày thanh toán</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.data.data.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="pl-4 font-medium">
                        {formatMonth(payout.periodMonth)}
                      </TableCell>
                      {!isAffiliate && <TableCell>{payout.affiliate.fullName}</TableCell>}
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {formatNumber(payout.commissionCount)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatVnd(payout.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <PayoutStatusBadge status={payout.status} />
                      </TableCell>
                      <TableCell className="hidden pr-4 text-muted-foreground tabular-nums sm:table-cell">
                        {payout.paidAt ? formatDate(payout.paidAt) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        )}

        {payouts.data && payouts.data.meta.total > 0 && (
          <PaginationBar
            page={url.page}
            pageSize={PAGE_SIZE}
            total={payouts.data.meta.total}
            onPageChange={(page) => url.update({ page })}
            noun="kỳ chi trả"
          />
        )}
      </div>
    </>
  )
}
