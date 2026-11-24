import { Bell, CheckCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Notification } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { NotificationList } from './notification-list'
import { notificationTarget } from './notification-target'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './queries'

const PANEL_SIZE = 8

/** Topbar bell: unread badge + the latest notifications in a popover. */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const notifications = useNotifications({ page: 1, pageSize: PANEL_SIZE })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const unread = notifications.data?.unreadCount ?? 0

  function openNotification(notification: Notification) {
    if (!notification.readAt) markRead.mutate(notification.id)
    setOpen(false)
    void navigate(notificationTarget(notification))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums"
              aria-hidden
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">Thông báo</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={unread === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck aria-hidden />
            Đánh dấu đã đọc
          </Button>
        </div>
        <div className="max-h-[min(28rem,70svh)] overflow-y-auto">
          {notifications.isPending ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : notifications.isError ? (
            <p className="p-4 text-sm text-destructive">Không tải được thông báo.</p>
          ) : notifications.data.data.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
          ) : (
            <NotificationList
              notifications={notifications.data.data}
              onOpen={openNotification}
              compact
            />
          )}
        </div>
        <div className="border-t p-1">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              Xem tất cả thông báo
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
