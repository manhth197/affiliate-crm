import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type NotificationQuery, notificationsApi } from '@/api/notifications'
import type { NotificationPage } from '@/api/types'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (query: NotificationQuery) => [...notificationKeys.all, query] as const,
}

export function useNotifications(query: NotificationQuery) {
  return useQuery({
    queryKey: notificationKeys.list(query),
    queryFn: ({ signal }) => notificationsApi.list(query, signal),
    placeholderData: keepPreviousData,
  })
}

/** Optimistically mark one notification read in every cached page, then sync. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: (id) => {
      const now = new Date().toISOString()
      queryClient.setQueriesData<NotificationPage>({ queryKey: notificationKeys.all }, (page) => {
        if (!page) return page
        const target = page.data.find((n) => n.id === id)
        if (!target || target.readAt) return page
        return {
          ...page,
          unreadCount: Math.max(0, page.unreadCount - 1),
          data: page.data.map((n) => (n.id === id ? { ...n, readAt: now } : n)),
        }
      })
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
