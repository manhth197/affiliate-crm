import { apiRequest } from './client'
import type { Notification, NotificationPage, PageQuery } from './types'

export type NotificationQuery = PageQuery & { unread?: boolean }

export const notificationsApi = {
  /** Newest first; `unreadCount` covers all pages. */
  list: (query: NotificationQuery, signal?: AbortSignal) =>
    apiRequest<NotificationPage>('/notifications', { query, signal }),

  markRead: (id: string) =>
    apiRequest<Notification>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),

  markAllRead: () => apiRequest<void>('/notifications/read-all', { method: 'PATCH' }),
}
