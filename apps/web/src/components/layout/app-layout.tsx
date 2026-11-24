import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router'
import { useCurrentUser } from '@/auth/auth-context'
import { NotificationBell } from '@/features/notifications/notification-bell'
import { RealtimeBridge } from '@/realtime/realtime-bridge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Brand } from './brand'
import { SidebarNav } from './sidebar-nav'
import { UserMenu } from './user-menu'

/** Shell for logged-in pages: fixed sidebar on desktop, drawer menu on mobile. */
export function AppLayout() {
  const user = useCurrentUser()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-svh bg-muted/40">
      <RealtimeBridge />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav role={user.role} />
        </div>
      </aside>

      <div className="flex min-h-svh flex-col md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-6">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Mở menu">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="h-14 justify-center border-b px-4">
                <SheetTitle asChild>
                  <div>
                    <Brand />
                  </div>
                </SheetTitle>
                <SheetDescription className="sr-only">Menu điều hướng</SheetDescription>
              </SheetHeader>
              <div className="p-3">
                <SidebarNav role={user.role} onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
