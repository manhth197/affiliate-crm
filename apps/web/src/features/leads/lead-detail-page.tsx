import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { isApiError } from '@/api/errors'
import type { Lead } from '@/api/types'
import { useCurrentUser } from '@/auth/auth-context'
import { QueryErrorAlert } from '@/components/feedback'
import { LeadStatusBadge } from '@/components/status-badge'
import { ForbiddenScreen, NotFoundScreen } from '@/components/status-screens'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatVnd } from '@/lib/format'
import { LeadStatusStepper } from './lead-status-stepper'
import { LeadTimeline } from './lead-timeline'
import { useLead, useLeadActivities } from './queries'

export function LeadDetailPage() {
  const { leadId = '' } = useParams()
  const user = useCurrentUser()
  const backOffice = user.role !== 'AFFILIATE'
  const lead = useLead(leadId)
  const activities = useLeadActivities(leadId, { enabled: lead.isSuccess })

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
      <Link to="/leads">
        <ArrowLeft aria-hidden />
        {backOffice ? 'Pipeline' : 'Lead của tôi'}
      </Link>
    </Button>
  )

  if (lead.isError) {
    if (isApiError(lead.error) && lead.error.status === 404) return <NotFoundScreen />
    if (isApiError(lead.error) && lead.error.status === 403) return <ForbiddenScreen />
    return (
      <>
        {backLink}
        <QueryErrorAlert error={lead.error} onRetry={() => void lead.refetch()} />
      </>
    )
  }

  if (lead.isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Đang tải lead">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const data = lead.data
  return (
    <>
      {backLink}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {data.customerName}
            </h1>
            <LeadStatusBadge status={data.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {data.code} · Tạo lúc {formatDateTime(data.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          {/* A rejected lead needs its timeline to know where it stopped. */}
          {(data.status !== 'REJECTED' || activities.data) && (
            <Card>
              <CardContent>
                <LeadStatusStepper status={data.status} activities={activities.data} />
              </CardContent>
            </Card>
          )}
          <LeadInfoCard lead={data} backOffice={backOffice} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lịch sử xử lý</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.isError ? (
              <QueryErrorAlert error={activities.error} onRetry={() => void activities.refetch()} />
            ) : activities.isPending ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <LeadTimeline activities={activities.data} partnerName={data.product.partnerName} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function LeadInfoCard({ lead, backOffice }: { lead: Lead; backOffice: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin hồ sơ</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <InfoItem label="Khách hàng">{lead.customerName}</InfoItem>
          <InfoItem label="Số điện thoại">
            <span className="tabular-nums">{lead.customerPhone}</span>
          </InfoItem>
          <InfoItem label="Số CCCD">
            <span className="tabular-nums">{lead.customerNationalId ?? '—'}</span>
          </InfoItem>
          <InfoItem label="Sản phẩm">
            {lead.product.name}
            <span className="block text-xs text-muted-foreground">{lead.product.partnerName}</span>
          </InfoItem>
          <InfoItem label="Số tiền đề nghị">{formatVnd(lead.requestedAmount)}</InfoItem>
          <InfoItem label="Số tiền giải ngân">{formatVnd(lead.disbursedAmount)}</InfoItem>
          <InfoItem label="Nhân viên phụ trách">
            {lead.assignedStaff?.fullName ?? 'Chưa phân công'}
          </InfoItem>
          {backOffice && (
            <InfoItem label="Cộng tác viên">
              {lead.affiliate.fullName}
              <span className="block text-xs text-muted-foreground">
                Mã {lead.affiliate.referralCode}
              </span>
            </InfoItem>
          )}
          <InfoItem label="Cập nhật lần cuối">{formatDateTime(lead.updatedAt)}</InfoItem>
        </dl>
        {!backOffice && (
          <p className="mt-4 text-xs text-muted-foreground">
            Số điện thoại và CCCD của khách được ẩn bớt để bảo vệ dữ liệu cá nhân.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  )
}
