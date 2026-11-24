import {
  ArrowRightLeft,
  Building2,
  type LucideIcon,
  MessageSquareText,
  Sparkles,
  UserCheck,
} from 'lucide-react'
import type { LeadActivity, LeadActivityType } from '@/api/types'
import { formatDateTime, formatRelative } from '@/lib/format'
import { LEAD_STATUS_LABELS } from '@/lib/labels'

const ICONS: Record<LeadActivityType, LucideIcon> = {
  CREATED: Sparkles,
  STATUS_CHANGED: ArrowRightLeft,
  ASSIGNED: UserCheck,
  NOTE: MessageSquareText,
  WEBHOOK: Building2,
}

function describe(activity: LeadActivity, partnerName: string): { title: string; actor: string } {
  const transition =
    activity.fromStatus && activity.toStatus
      ? `${LEAD_STATUS_LABELS[activity.fromStatus]} → ${LEAD_STATUS_LABELS[activity.toStatus]}`
      : ''
  const actor = activity.actor?.fullName ?? `Đối tác ${partnerName}`
  switch (activity.type) {
    case 'CREATED':
      return { title: 'Tạo lead', actor }
    case 'STATUS_CHANGED':
      return { title: `Chuyển trạng thái: ${transition}`, actor }
    case 'WEBHOOK':
      return { title: `Đối tác cập nhật: ${transition}`, actor: `Đối tác ${partnerName}` }
    case 'ASSIGNED':
      return { title: 'Phân công nhân viên phụ trách', actor }
    case 'NOTE':
      return { title: 'Ghi chú nội bộ', actor }
  }
}

/** Activity history, newest first (the API's order). */
export function LeadTimeline({
  activities,
  partnerName,
}: {
  activities: LeadActivity[]
  partnerName: string
}) {
  return (
    <ol aria-label="Lịch sử xử lý" className="relative space-y-5">
      {activities.map((activity, index) => {
        const Icon = ICONS[activity.type]
        const { title, actor } = describe(activity, partnerName)
        return (
          <li key={activity.id} className="relative flex gap-3">
            {index < activities.length - 1 && (
              <span
                className="absolute top-8 bottom-[-1.25rem] left-3.75 w-px bg-border"
                aria-hidden
              />
            )}
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5 pt-1">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">
                {actor} ·{' '}
                <time dateTime={activity.createdAt} title={formatDateTime(activity.createdAt)}>
                  {formatRelative(activity.createdAt)}
                </time>
              </p>
              {activity.note && (
                <p className="mt-1 rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-line">
                  {activity.note}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
