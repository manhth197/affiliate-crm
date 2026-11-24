import { cn } from 'cn'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Lead, LeadQuery } from '@/api/types'
import { EmptyState, QueryErrorAlert } from '@/components/feedback'
import { PaginationBar } from '@/components/pagination-bar'
import { LeadStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { leadAmount } from './lead-rules'
import { useLeads } from './queries'

type LeadListViewProps = {
  query: LeadQuery & { page: number; pageSize: number }
  backOffice: boolean
  hasFilters: boolean
  onPageChange: (page: number | null) => void
  /** Shown when there are no leads at all (not just none matching the filters). */
  empty: { title: string; description: string; action?: ReactNode }
}

/** Paginated lead list: table on desktop, cards on phones, with loading/empty/error states. */
export function LeadListView({
  query,
  backOffice,
  hasFilters,
  onPageChange,
  empty,
}: LeadListViewProps) {
  const leads = useLeads(query)

  return (
    <>
      {leads.isError ? (
        <QueryErrorAlert error={leads.error} onRetry={() => void leads.refetch()} />
      ) : (
        <Card className={cn('py-0', leads.isPlaceholderData && 'opacity-60')}>
          {leads.isPending ? (
            <LeadListSkeleton />
          ) : leads.data.data.length === 0 ? (
            leads.data.meta.total > 0 ? (
              // e.g. ?page=9 from an old link after the list got shorter
              <EmptyState
                title="Trang này không còn dữ liệu"
                action={
                  <Button variant="outline" onClick={() => onPageChange(null)}>
                    Về trang đầu
                  </Button>
                }
              />
            ) : hasFilters ? (
              <EmptyState
                title="Không có lead nào khớp bộ lọc"
                description="Thử bỏ bớt điều kiện lọc hoặc tìm với từ khóa khác."
              />
            ) : (
              <EmptyState
                title={empty.title}
                description={empty.description}
                action={empty.action}
              />
            )
          ) : (
            <>
              <LeadTable leads={leads.data.data} backOffice={backOffice} />
              <LeadCards leads={leads.data.data} />
            </>
          )}
        </Card>
      )}

      {leads.data && leads.data.data.length > 0 && (
        <PaginationBar
          page={query.page}
          pageSize={query.pageSize}
          total={leads.data.meta.total}
          onPageChange={onPageChange}
          noun="lead"
        />
      )}
    </>
  )
}

/** Desktop: a table; the whole row opens the lead, the code is a real link for keyboards. */
function LeadTable({ leads, backOffice }: { leads: Lead[]; backOffice: boolean }) {
  const navigate = useNavigate()
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Mã</TableHead>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Sản phẩm</TableHead>
            {backOffice && <TableHead>Cộng tác viên</TableHead>}
            {backOffice && <TableHead>Phụ trách</TableHead>}
            <TableHead className="text-right">Số tiền</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead className="pr-4">Ngày tạo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow
              key={lead.id}
              className="cursor-pointer"
              onClick={() => void navigate(`/leads/${lead.id}`)}
            >
              <TableCell className="pl-4 font-medium">
                <Link
                  to={`/leads/${lead.id}`}
                  className="hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {lead.code}
                </Link>
              </TableCell>
              <TableCell>
                <div className="font-medium">{lead.customerName}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {lead.customerPhone}
                </div>
              </TableCell>
              <TableCell>
                <div>{lead.product.name}</div>
                <div className="text-xs text-muted-foreground">{lead.product.partnerName}</div>
              </TableCell>
              {backOffice && <TableCell>{lead.affiliate.fullName}</TableCell>}
              {backOffice && (
                <TableCell>
                  {lead.assignedStaff?.fullName ?? (
                    <span className="text-muted-foreground">Chưa phân công</span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">
                {formatVnd(leadAmount(lead))}
              </TableCell>
              <TableCell>
                <LeadStatusBadge status={lead.status} />
              </TableCell>
              <TableCell
                className="pr-4 text-muted-foreground tabular-nums"
                title={formatDateTime(lead.createdAt)}
              >
                {formatDate(lead.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Mobile: one tappable card per lead. */
function LeadCards({ leads }: { leads: Lead[] }) {
  return (
    <ul aria-label="Danh sách lead" className="divide-y md:hidden">
      {leads.map((lead) => (
        <li key={lead.id}>
          <Link to={`/leads/${lead.id}`} className="flex flex-col gap-1 p-4 active:bg-muted">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{lead.customerName}</span>
              <LeadStatusBadge status={lead.status} />
            </div>
            <div className="text-sm text-muted-foreground">{lead.product.name}</div>
            <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
              <span>
                {lead.code} · {formatDate(lead.createdAt)}
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatVnd(leadAmount(lead))}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function LeadListSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-busy="true" aria-label="Đang tải danh sách lead">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}
