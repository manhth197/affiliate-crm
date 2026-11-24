import { http, HttpResponse } from 'msw'
import type { NotificationPage } from '@/api/types'
import { db } from '../db'
import { api, apiError, authenticate, latency } from '../http'
import { toNotification } from '../notify'
import { paginate, readQuery, withQueryErrors } from '../query'

export const notificationHandlers = [
  http.get(api('/notifications'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    return withQueryErrors(() => {
      const query = readQuery(request)
      const unreadOnly = query.boolean('unread') === true
      const page = query.page()
      const mine = db.notifications.filter((n) => n.userId === auth.user.id)
      const items = mine
        .filter((n) => !unreadOnly || n.readAt === null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const result = paginate(items, page)
      return HttpResponse.json<NotificationPage>({
        data: result.data.map(toNotification),
        meta: result.meta,
        unreadCount: mine.filter((n) => n.readAt === null).length,
      })
    })
  }),

  http.patch(api('/notifications/read-all'), async ({ request }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    const now = new Date().toISOString()
    for (const n of db.notifications) {
      if (n.userId === auth.user.id && n.readAt === null) n.readAt = now
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch(api('/notifications/:id/read'), async ({ request, params }) => {
    await latency()
    const auth = authenticate(request)
    if (auth.error) return auth.error
    const notification = db.notifications.find((n) => n.id === params.id)
    // Someone else's notification looks the same as a missing one.
    if (!notification || notification.userId !== auth.user.id) {
      return apiError(404, 'Notification not found')
    }
    notification.readAt ??= new Date().toISOString()
    return HttpResponse.json(toNotification(notification))
  }),
]
