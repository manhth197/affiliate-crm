import { lazy, Suspense } from 'react'
import { FullPageSpinner } from '@/components/status-screens'

/** Loaded on demand: Recharts is large and only staff/admins open reports. */
const ReportsPage = lazy(() =>
  import('./reports-page').then((module) => ({ default: module.ReportsPage })),
)

export function ReportsRoute() {
  return (
    <Suspense fallback={<FullPageSpinner label="Đang tải báo cáo…" />}>
      <ReportsPage />
    </Suspense>
  )
}
