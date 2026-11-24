import type { Notification } from '@/api/types'
import { db } from './db'
import type { NotificationContent } from './notification-content'
import { mockRealtime } from './realtime'
import type { NotificationRecord } from './records'

export function toNotification(record: NotificationRecord): Notification {
  const { userId: _userId, ...notification } = record
  return notification
}

/** Store a notification and push it to the user's sockets (what the API's job does). */
export function notify(userId: string, content: NotificationContent) {
  const record: NotificationRecord = {
    id: crypto.randomUUID(),
    userId,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...content,
  }
  db.notifications.push(record)
  mockRealtime.emit(`user:${userId}`, 'notification:new', toNotification(record))
  return record
}
