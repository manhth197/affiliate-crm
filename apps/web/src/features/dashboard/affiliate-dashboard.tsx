import { ArrowRight, Copy, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import type { LeadQuery, Me } from '@/api/types'
import { EmptyState, QueryErrorAlert } from '@/components/feedback'
import { PageHeader } from '@/components/page-header'
import { LeadStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CommissionSummaryCards } from '@/features/finance/commission-summary-cards'
import { useLeads } from '@/features/leads/queries'
import { formatDateTime, formatRelative } from '@/lib/format'

const RECENT_QUERY: LeadQuery = { page: 1, pageSize: 5, sort: 'createdAt:desc' }

export function AffiliateDashboard({ user }: { user: Me }) {
  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description="Tổng quan hoa hồng và các khách hàng bạn đã giới thiệu."
        actions={
          <Button asChild>
            <Link to="/leads/new">
              <Plus aria-hidden />
              Giới thiệu khách hàng
            </Link>
          </Button>
        }
      />
      <div className="space-y-4">
        <CommissionSummaryCards />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <RecentLeadsCard />
          {user.affiliate && <ReferralCodeCard code={user.affiliate.referralCode} />}
        </div>
      </div>
    </>
  )
}

function RecentLeadsCard() {
  const leads = useLeads(RECENT_QUERY)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead gần đây</CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link to="/leads">
              Xem tất cả
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {leads.isError ? (
          <QueryErrorAlert error={leads.error} onRetry={() => void leads.refetch()} />
        ) : leads.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : leads.data.data.length === 0 ? (
          <EmptyState
            title="Chưa có lead nào"
            description="Giới thiệu khách hàng đầu tiên để bắt đầu nhận hoa hồng."
          />
        ) : (
          <ul aria-label="Lead gần đây" className="-mx-2 divide-y">
            {leads.data.data.map((lead) => (
              <li key={lead.id}>
                <Link
                  to={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{lead.customerName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {lead.product.name} ·{' '}
                      <time dateTime={lead.createdAt} title={formatDateTime(lead.createdAt)}>
                        {formatRelative(lead.createdAt)}
                      </time>
                    </p>
                  </div>
                  <LeadStatusBadge status={lead.status} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ReferralCodeCard({ code }: { code: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Đã sao chép mã giới thiệu')
    } catch {
      toast.error('Không sao chép được, vui lòng chép thủ công')
    }
  }

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>Mã giới thiệu của bạn</CardTitle>
        <CardDescription>Gửi mã này cho khách hàng hoặc đối tác khi giới thiệu.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <span className="rounded-md bg-muted px-3 py-1.5 font-mono text-lg font-semibold tracking-wider">
          {code}
        </span>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          <Copy aria-hidden />
          Sao chép
        </Button>
      </CardContent>
    </Card>
  )
}
