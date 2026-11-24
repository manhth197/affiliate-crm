import type { Product } from '@/api/types'
import {
  commissionCreatedContent,
  leadAssignedContent,
  leadStatusContent,
  payoutPaidContent,
} from './notification-content'
import type { NotificationRecord } from './records'
import type { LeadSeed } from './seed-leads'

const DAY = 24 * 60 * 60 * 1000
/** Notifications from the last two weeks; the ones older than 3 days are already read. */
const WINDOW_DAYS = 14
const UNREAD_DAYS = 3

/** Rebuild the notifications the API would have sent for the seeded history. */
export function createNotificationSeed(
  seed: LeadSeed,
  products: readonly Product[],
  now: number,
): NotificationRecord[] {
  const notifications: NotificationRecord[] = []
  let n = 0
  const add = (userId: string, at: string, content: ReturnType<typeof leadStatusContent>) => {
    const age = now - Date.parse(at)
    if (age > WINDOW_DAYS * DAY) return
    notifications.push({
      id: `00000000-0000-4000-0005-${String(++n).padStart(12, '0')}`,
      userId,
      readAt: age > UNREAD_DAYS * DAY ? new Date(Date.parse(at) + DAY).toISOString() : null,
      createdAt: at,
      ...content,
    })
  }
  const leadById = new Map(seed.leads.map((lead) => [lead.id, lead]))

  for (const activity of seed.activities) {
    const lead = leadById.get(activity.leadId)!
    if ((activity.type === 'STATUS_CHANGED' || activity.type === 'WEBHOOK') && activity.toStatus) {
      // The text shows the status reached by this change, not the lead's current one.
      add(
        lead.affiliateId,
        activity.createdAt,
        leadStatusContent({ ...lead, status: activity.toStatus }),
      )
    }
    if (activity.type === 'ASSIGNED' && activity.assigneeId) {
      const product = products.find((p) => p.id === lead.productId)
      add(activity.assigneeId, activity.createdAt, leadAssignedContent(lead, product?.name ?? ''))
    }
  }
  for (const commission of seed.commissions) {
    add(
      commission.affiliateId,
      commission.createdAt,
      commissionCreatedContent(commission, leadById.get(commission.leadId)!),
    )
  }
  for (const payout of seed.payouts) {
    if (payout.paidAt) add(payout.affiliateId, payout.paidAt, payoutPaidContent(payout))
  }
  return notifications.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}
