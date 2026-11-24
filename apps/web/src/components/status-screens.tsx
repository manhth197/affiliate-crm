import { LoaderCircle, RefreshCw, SearchX, ShieldX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function FullPageSpinner({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center" role="status" aria-live="polite">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

type MessageScreenProps = {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function MessageScreen({ icon, title, description, action }: MessageScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

export function ForbiddenScreen() {
  return (
    <MessageScreen
      icon={<ShieldX className="size-6" aria-hidden />}
      title="Không có quyền truy cập"
      description="Tài khoản của bạn không được phép xem trang này. Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ quản trị viên."
      action={
        <Button asChild variant="outline">
          <Link to="/">Về trang tổng quan</Link>
        </Button>
      }
    />
  )
}

export function NotFoundScreen() {
  return (
    <MessageScreen
      icon={<SearchX className="size-6" aria-hidden />}
      title="Không tìm thấy trang"
      description="Đường dẫn không tồn tại hoặc đã được thay đổi."
      action={
        <Button asChild variant="outline">
          <Link to="/">Về trang tổng quan</Link>
        </Button>
      }
    />
  )
}

export function ErrorScreen({
  title = 'Không tải được dữ liệu',
  description = 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <MessageScreen
      icon={<RefreshCw className="size-6" aria-hidden />}
      title={title}
      description={description}
      action={onRetry && <Button onClick={onRetry}>Thử lại</Button>}
    />
  )
}
