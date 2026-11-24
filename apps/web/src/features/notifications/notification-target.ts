import type { Notification } from '@/api/types'

/** Where clicking a notification goes (contract: `data.leadId` opens the lead). */
export function notificationTarget(notification: Notification): string {
  if (notification.data.leadId) return `/leads/${notification.data.leadId}`
  if (notification.type === 'PAYOUT_PAID') return '/payouts'
  return '/notifications'
}
