import type {
  CommissionStatus,
  LeadActivityType,
  LeadStatus,
  NotificationType,
  PayoutStatus,
} from '@/api/types'

/**
 * Rows of the mock database. Like real tables they store foreign keys; the handlers join
 * them into the API shapes (and mask PII for affiliates) in `serialize.ts`.
 */
export type LeadRecord = {
  id: string
  code: string
  affiliateId: string
  productId: string
  customerName: string
  /** Stored unmasked, as `0XXXXXXXXX`. */
  customerPhone: string
  customerNationalId: string | null
  requestedAmount: number | null
  disbursedAmount: number | null
  status: LeadStatus
  assignedStaffId: string | null
  createdAt: string
  updatedAt: string
}

export type ActivityRecord = {
  id: string
  leadId: string
  type: LeadActivityType
  fromStatus: LeadStatus | null
  toStatus: LeadStatus | null
  note: string | null
  /** null = partner webhook */
  actorId: string | null
  /** Set on ASSIGNED entries (contract v0.3). */
  assigneeId: string | null
  createdAt: string
}

export type CommissionRecord = {
  id: string
  leadId: string
  affiliateId: string
  amount: number
  status: CommissionStatus
  payoutId: string | null
  createdAt: string
}

export type PayoutRecord = {
  id: string
  affiliateId: string
  periodMonth: string
  totalAmount: number
  commissionCount: number
  status: PayoutStatus
  paidAt: string | null
  createdAt: string
}

export type NotificationRecord = {
  id: string
  /** Recipient. */
  userId: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, string>
  readAt: string | null
  createdAt: string
}
