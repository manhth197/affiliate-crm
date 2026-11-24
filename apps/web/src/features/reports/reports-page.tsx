import { CircleDollarSign, Coins, FileStack, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { type CommissionStatus, LEAD_STATUSES } from '@/api/types'
import { EmptyState, QueryErrorAlert } from '@/components/feedback'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { formatDate, formatNumber, formatPercent, formatVnd } from '@/lib/format'
import { COMMISSION_STATUS_LABELS, LEAD_STATUS_LABELS } from '@/lib/labels'
import { useUrlState } from '@/lib/use-url-state'
import { useReportOverview, useTopAffiliates } from './queries'
import { CategoryBarChart, LeadsPerDayChart } from './report-charts'
import {
  DEFAULT_RANGE,
  presetDays,
  presetRange,
  RANGE_PRESETS,
  type RangePreset,
} from './report-range'

const COMMISSION_ORDER: CommissionStatus[] = ['PENDING', 'APPROVED', 'PAID', 'CANCELLED']

/** STAFF/ADMIN: pipeline and commission figures for a date range (Vietnam calendar). */
export function ReportsPage() {
  const url = useUrlState()
  const preset = (Object.keys(RANGE_PRESETS) as RangePreset[]).find((p) => p === url.get('range'))
  const active = preset ?? DEFAULT_RANGE
  const range = presetRange(active)
  const days = presetDays(active)
  const overview = useReportOverview(range)
  const top = useTopAffiliates(range)

  const data = overview.data
  const totalLeads = data ? LEAD_STATUSES.reduce((sum, s) => sum + data.leadsByStatus[s], 0) : 0
  const earned = data
    ? data.commissionByStatus.PENDING +
      data.commissionByStatus.APPROVED +
      data.commissionByStatus.PAID
    : 0

  return (
    <>
      <PageHeader
        title="Báo cáo"
        description={`Từ ${formatDate(range.from)} đến hết ${days.last.split('-').reverse().join('/')} (giờ Việt Nam). Lead tính theo ngày tạo.`}
        actions={
          <NativeSelect
            aria-label="Khoảng thời gian"
            className="w-full sm:w-56"
            value={active}
            onChange={(event) =>
              url.update({
                range: event.target.value === DEFAULT_RANGE ? null : event.target.value,
              })
            }
          >
            {(Object.keys(RANGE_PRESETS) as RangePreset[]).map((p) => (
              <NativeSelectOption key={p} value={p}>
                {RANGE_PRESETS[p]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        }
      />

      {overview.isError ? (
        <QueryErrorAlert error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Lead mới"
              icon={FileStack}
              loading={!data}
              value={formatNumber(totalLeads)}
            />
            <StatCard
              label="Tỉ lệ giải ngân"
              icon={TrendingUp}
              loading={!data}
              value={data ? formatPercent(data.conversionRate) : ''}
              hint={
                data ? `${formatNumber(data.leadsByStatus.DISBURSED)} lead đã giải ngân` : undefined
              }
            />
            <StatCard
              label="Số tiền giải ngân"
              icon={CircleDollarSign}
              loading={!data}
              value={data ? formatVnd(data.disbursedAmount) : ''}
            />
            <StatCard
              label="Hoa hồng phát sinh"
              icon={Coins}
              loading={!data}
              value={formatVnd(earned)}
              hint="Chờ duyệt + đã duyệt + đã trả"
            />
          </div>

          <ChartCard
            title="Lead mới theo ngày"
            loading={!data}
            table={
              data && (
                <DataTable
                  head={['Ngày', 'Lead']}
                  rows={data.leadsPerDay.map((d) => [
                    d.date.split('-').reverse().join('/'),
                    formatNumber(d.count),
                  ])}
                />
              )
            }
          >
            {data && <LeadsPerDayChart data={data.leadsPerDay} />}
          </ChartCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Lead theo trạng thái hiện tại"
              loading={!data}
              table={
                data && (
                  <DataTable
                    head={['Trạng thái', 'Lead']}
                    rows={LEAD_STATUSES.map((s) => [
                      LEAD_STATUS_LABELS[s],
                      formatNumber(data.leadsByStatus[s]),
                    ])}
                  />
                )
              }
            >
              {data && (
                <CategoryBarChart
                  rows={LEAD_STATUSES.map((s) => ({
                    label: LEAD_STATUS_LABELS[s],
                    value: data.leadsByStatus[s],
                  }))}
                  formatValue={formatNumber}
                />
              )}
            </ChartCard>
            <ChartCard
              title="Hoa hồng theo trạng thái"
              description="Tổng tiền, theo ngày tạo hoa hồng"
              loading={!data}
              table={
                data && (
                  <DataTable
                    head={['Trạng thái', 'Số tiền']}
                    rows={COMMISSION_ORDER.map((s) => [
                      COMMISSION_STATUS_LABELS[s],
                      formatVnd(data.commissionByStatus[s]),
                    ])}
                  />
                )
              }
            >
              {data && (
                <CategoryBarChart
                  rows={COMMISSION_ORDER.map((s) => ({
                    label: COMMISSION_STATUS_LABELS[s],
                    value: data.commissionByStatus[s],
                  }))}
                  formatValue={formatVnd}
                />
              )}
            </ChartCard>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Cộng tác viên dẫn đầu</h2>
              </CardTitle>
              <CardDescription>Theo hoa hồng (không tính hoa hồng đã hủy)</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {top.isError ? (
                <div className="px-4">
                  <QueryErrorAlert error={top.error} onRetry={() => void top.refetch()} />
                </div>
              ) : top.isPending ? (
                <div className="space-y-2 px-4">
                  {Array.from({ length: 3 }, (_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : top.data.length === 0 ? (
                <EmptyState title="Chưa có dữ liệu trong khoảng này" />
              ) : (
                <Table aria-label="Cộng tác viên dẫn đầu">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 pl-4">#</TableHead>
                      <TableHead>Cộng tác viên</TableHead>
                      <TableHead className="text-right">Lead</TableHead>
                      <TableHead className="text-right">Giải ngân</TableHead>
                      <TableHead className="pr-4 text-right">Hoa hồng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {top.data.map((row, index) => (
                      <TableRow key={row.affiliate.id}>
                        <TableCell className="pl-4 text-muted-foreground tabular-nums">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.affiliate.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.affiliate.referralCode}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.leads)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.disbursed)}
                        </TableCell>
                        <TableCell className="pr-4 text-right font-medium tabular-nums">
                          {formatVnd(row.commission)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}

function ChartCard({
  title,
  description,
  loading,
  table,
  children,
}: {
  title: string
  description?: string
  loading: boolean
  table: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-48 w-full" /> : children}
        {!loading && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Xem dữ liệu dạng bảng
            </summary>
            <div className="mt-2 max-h-64 overflow-y-auto">{table}</div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

function DataTable({ head, rows }: { head: [string, string]; rows: string[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 font-normal">{head[0]}</th>
          <th className="py-1 text-right font-normal">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b last:border-0">
            <td className="py-1">{label}</td>
            <td className="py-1 text-right tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
