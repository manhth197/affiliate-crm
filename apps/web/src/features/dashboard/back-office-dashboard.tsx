import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import type { LeadStatus, Me } from '@/api/types'
import { ROLE_LABELS } from '@/auth/roles'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useLeads } from '@/features/leads/queries'
import { formatNumber } from '@/lib/format'
import { LEAD_STATUS_LABELS } from '@/lib/labels'

/** Open pipeline stages; the full reports dashboard comes with the reports milestone. */
const OPEN_STATUSES: readonly LeadStatus[] = ['NEW', 'CONTACTED', 'SUBMITTED', 'APPROVED']

export function BackOfficeDashboard({ user }: { user: Me }) {
  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description={
          <span className="inline-flex items-center gap-2">
            Vai trò <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
          </span>
        }
      />
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Lead đang xử lý</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {OPEN_STATUSES.map((status) => (
          <StatusCountCard key={status} status={status} />
        ))}
      </div>
    </>
  )
}

/** Count from the list endpoint's `meta.total` (pageSize 1 keeps the response tiny). */
function StatusCountCard({ status }: { status: LeadStatus }) {
  const leads = useLeads({ status, page: 1, pageSize: 1 })
  return (
    <Link to={`/leads?status=${status}`} className="group rounded-xl focus-visible:outline-2">
      <Card size="sm" className="transition-colors group-hover:bg-muted/50">
        <CardContent className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{LEAD_STATUS_LABELS[status]}</span>
          {leads.isPending ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <span className="text-2xl font-semibold tabular-nums">
              {leads.isError ? '—' : formatNumber(leads.data.meta.total)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            Xem danh sách <ArrowRight className="size-3" aria-hidden />
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
