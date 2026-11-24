import { useRouteError } from 'react-router'
import { ErrorScreen } from '@/components/status-screens'

/** Last-resort screen when a route throws while rendering. */
export function RouteErrorPage() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="flex min-h-svh items-center justify-center">
      <ErrorScreen
        title="Đã có lỗi xảy ra"
        description="Trang gặp sự cố không mong muốn. Vui lòng tải lại trang."
        onRetry={() => window.location.reload()}
      />
    </div>
  )
}
