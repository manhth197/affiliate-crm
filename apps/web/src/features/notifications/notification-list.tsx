import { cn } from 'cn'
import {
  ArrowRightLeft,
  BadgeDollarSign,
  type LucideIcon,
  UserCheck,
  WalletCards,
} from 'lucide-react'
import type { Notification, NotificationType } from '@/api/types'
import { formatDateTime, formatRelative } from '@/lib/format'

const ICONS: Record<NotificationType, LucideIcon> = {
  LEAD_STATUS_CHANGED: ArrowRightLeft,
  LEAD_ASSIGNED: UserCheck,
  COMMISSION_CREATED: BadgeDollarSign,
  PAYOUT_PAID: WalletCards,
}

/** Clickable notification rows; unread ones are bold with a dot. */
export function NotificationList({
  notifications,
  onOpen,
  compact = false,
}: {
  notifications: Notification[]
  onOpen: (notification: Notification) => void
  compact?: boolean
}) {
  return (
    <ul aria-label="Danh sách thông báo" className="divide-y">
      {notifications.map((notification) => {
        const Icon = ICONS[notification.type]
        const unread = notification.readAt === null
        return (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => onOpen(notification)}
              className={cn(
                'flex w-full gap-3 px-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                compact ? 'py-2.5' : 'py-3.5',
              )}
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm', unread && 'font-semibold')}>
                  {notification.title}
                  {unread && <span className="sr-only"> (chưa đọc)</span>}
                </span>
                <span
                  className={cn('block text-xs text-muted-foreground', compact && 'line-clamp-2')}
                >
                  {notification.body}
                </span>
                <time
                  dateTime={notification.createdAt}
                  title={formatDateTime(notification.createdAt)}
                  className="mt-0.5 block text-xs text-muted-foreground"
                >
                  {formatRelative(notification.createdAt)}
                </time>
              </span>
              {unread && (
                <span className="mt-2 size-2 shrink-0 rounded-full bg-sky-600" aria-hidden />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
