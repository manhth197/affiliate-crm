import { BadgeCheck, CircleDollarSign, Clock, TrendingUp } from 'lucide-react'
import { QueryErrorAlert } from '@/components/feedback'
import { StatCard } from '@/components/stat-card'
import { formatNumber, formatPercent, formatVnd } from '@/lib/format'
import { useCommissionSummary } from './queries'

/** Affiliate's commission totals (GET /commissions/summary). */
export function CommissionSummaryCards() {
  const summary = useCommissionSummary()

  if (summary.isError) {
    return <QueryErrorAlert error={summary.error} onRetry={() => void summary.refetch()} />
  }

  const data = summary.data
  const loading = summary.isPending
  const conversion = data && data.totalLeads > 0 ? data.disbursedLeads / data.totalLeads : 0

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Chờ duyệt"
        icon={Clock}
        loading={loading}
        value={formatVnd(data?.pending)}
        hint="Hoa hồng mới, chờ quản trị duyệt"
      />
      <StatCard
        label="Đã duyệt"
        icon={BadgeCheck}
        loading={loading}
        value={formatVnd(data?.approved)}
        hint="Sẽ được chi trả trong kỳ tới"
      />
      <StatCard
        label="Đã nhận"
        icon={CircleDollarSign}
        loading={loading}
        value={formatVnd(data?.paid)}
        hint="Tổng đã thanh toán cho bạn"
      />
      <StatCard
        label="Tỉ lệ giải ngân"
        icon={TrendingUp}
        loading={loading}
        value={formatPercent(conversion)}
        hint={
          data
            ? `${formatNumber(data.disbursedLeads)}/${formatNumber(data.totalLeads)} lead thành công`
            : undefined
        }
      />
    </div>
  )
}
