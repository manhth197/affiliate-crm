import { cn } from 'cn'
import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import type { Lead } from '@/api/types'
import { useCurrentUser } from '@/auth/auth-context'
import { EmptyState, QueryErrorAlert } from '@/components/feedback'
import { PageHeader } from '@/components/page-header'
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
import { useProducts } from '@/features/catalog/queries'
import { formatDate, formatDateTime, formatVnd } from '@/lib/format'
import { LeadFilters } from './lead-filters'
import { useLeads } from './queries'
import { LEADS_PAGE_SIZE, useLeadFilters } from './use-lead-filters'

/** The amount that matters most: disbursed if known, otherwise requested. */
function leadAmount(lead: Lead) {
  return lead.disbursedAmount ?? lead.requestedAmount
}

export function LeadsPage() {
  const user = useCurrentUser()
  const backOffice = user.role !== 'AFFILIATE'
  const { query, hasFilters, page, update } = useLeadFilters()
  const leads = useLeads(query)
  const products = useProducts()

  return (
    <>
      <PageHeader
        title={backOffice ? 'Pipeline' : 'Lead của tôi'}
        description={
          backOffice
            ? 'Toàn bộ lead của cộng tác viên, mới nhất trước.'
            : 'Theo dõi trạng thái các khách hàng bạn đã giới thiệu.'
        }
        actions={
          !backOffice && (
            <Button asChild>
              <Link to="/leads/new">
                <Plus aria-hidden />
                Giới thiệu khách hàng
              </Link>
            </Button>
          )
        }
      />

      <div className="space-y-4">
        <LeadFilters products={products.data ?? []} />

        {leads.isError ? (
          <QueryErrorAlert error={leads.error} onRetry={() => void leads.refetch()} />
        ) : (
          <Card className={cn('py-0', leads.isPlaceholderData && 'opacity-60')}>
            {leads.isPending ? (
              <LeadListSkeleton />
            ) : leads.data.data.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  title="Không có lead nào khớp bộ lọc"
                  description="Thử bỏ bớt điều kiện lọc hoặc tìm với từ khóa khác."
                />
              ) : (
                <EmptyState
                  title="Chưa có lead nào"
                  description={
                    backOffice
                      ? 'Lead mới từ cộng tác viên sẽ xuất hiện ở đây.'
                      : 'Giới thiệu khách hàng đầu tiên để bắt đầu nhận hoa hồng.'
                  }
                  action={
                    !backOffice && (
                      <Button asChild>
                        <Link to="/leads/new">Giới thiệu khách hàng</Link>
                      </Button>
                    )
                  }
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

        {leads.data && leads.data.meta.total > 0 && (
          <PaginationBar
            page={page}
            pageSize={LEADS_PAGE_SIZE}
            total={leads.data.meta.total}
            onPageChange={(next) => update({ page: next })}
            noun="lead"
          />
        )}
      </div>
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
