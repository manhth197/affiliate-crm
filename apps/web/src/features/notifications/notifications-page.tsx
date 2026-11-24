import { CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router'
import type { Notification } from '@/api/types'
import { EmptyState, QueryErrorAlert } from '@/components/feedback'
import { PageHeader } from '@/components/page-header'
import { PaginationBar } from '@/components/pagination-bar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useUrlState } from '@/lib/use-url-state'
import { NotificationList } from './notification-list'
import { notificationTarget } from './notification-target'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './queries'

const PAGE_SIZE = 20

export function NotificationsPage() {
  const navigate = useNavigate()
  const url = useUrlState()
  const unreadOnly = url.get('unread') === 'true'
  const notifications = useNotifications({
    unread: unreadOnly || undefined,
    page: url.page,
    pageSize: PAGE_SIZE,
  })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const unread = notifications.data?.unreadCount ?? 0

  function open(notification: Notification) {
    if (!notification.readAt) markRead.mutate(notification.id)
    void navigate(notificationTarget(notification))
  }

  return (
    <>
      <PageHeader
        title="Thông báo"
        description={unread > 0 ? `${unread} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo.'}
        actions={
          <>
            <div role="group" aria-label="Lọc thông báo" className="flex rounded-lg border p-0.5">
              <Button
                size="sm"
                variant={unreadOnly ? 'ghost' : 'secondary'}
                aria-pressed={!unreadOnly}
                onClick={() => url.update({ unread: null })}
              >
                Tất cả
              </Button>
              <Button
                size="sm"
                variant={unreadOnly ? 'secondary' : 'ghost'}
                aria-pressed={unreadOnly}
                onClick={() => url.update({ unread: 'true' })}
              >
                Chưa đọc
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={unread === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck aria-hidden />
              Đánh dấu đã đọc tất cả
            </Button>
          </>
        }
      />
      <div className="space-y-4">
        {notifications.isError ? (
          <QueryErrorAlert
            error={notifications.error}
            onRetry={() => void notifications.refetch()}
          />
        ) : (
          <Card className="py-0">
            {notifications.isPending ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : notifications.data.data.length === 0 ? (
              <EmptyState
                title={unreadOnly ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
              />
            ) : (
              <NotificationList notifications={notifications.data.data} onOpen={open} />
            )}
          </Card>
        )}
        {notifications.data && notifications.data.data.length > 0 && (
          <PaginationBar
            page={url.page}
            pageSize={PAGE_SIZE}
            total={notifications.data.meta.total}
            onPageChange={(page) => url.update({ page })}
            noun="thông báo"
          />
        )}
      </div>
    </>
  )
}
