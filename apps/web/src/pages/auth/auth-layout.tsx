import { Outlet } from 'react-router'
import { Brand } from '@/components/layout/brand'

export function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-10">
      <Brand to="/login" />
      <main className="w-full max-w-md">
        <Outlet />
      </main>
      <p className="text-center text-xs text-muted-foreground">
        Nền tảng quản lý cộng tác viên giới thiệu khách hàng tài chính
      </p>
    </div>
  )
}
