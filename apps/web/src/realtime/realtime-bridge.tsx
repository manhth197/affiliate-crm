import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCurrentUser } from '@/auth/auth-context'
import { financeKeys } from '@/features/finance/queries'
import { leadKeys } from '@/features/leads/queries'
import { notificationTarget } from '@/features/notifications/notification-target'
import { notificationKeys } from '@/features/notifications/queries'
import { useConnectRealtime } from './realtime-context'

/**
 * Keeps one realtime connection open while the user is in the app and turns server events
 * into cache invalidations (TanStack Query refetches what is on screen) and toasts.
 * Renders nothing.
 */
export function RealtimeBridge() {
  const { id, role } = useCurrentUser()
  const connect = useConnectRealtime()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  useEffect(() => {
    const connection = connect({ id, role })
    const subscriptions = [
      connection.on('notification:new', (notification) => {
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all })
        const target = notificationTarget(notification)
        toast(notification.title, {
          description: notification.body,
          action: { label: 'Xem', onClick: () => void navigateRef.current(target) },
        })
      }),
      connection.on('lead:updated', ({ leadId }) => {
        void queryClient.invalidateQueries({ queryKey: leadKeys.detail(leadId) })
        void queryClient.invalidateQueries({ queryKey: leadKeys.lists() })
        // Affiliates: the dashboard summary counts disbursed leads.
        void queryClient.invalidateQueries({ queryKey: financeKeys.summary() })
      }),
      connection.on('payout:updated', () => {
        void queryClient.invalidateQueries({ queryKey: financeKeys.all })
      }),
    ]
    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe())
      connection.close()
    }
  }, [connect, id, role, queryClient])

  return null
}
