import type { Commission, Payout } from '@/api/types'

/** Contract v0.4: approve from PENDING; cancel from PENDING/APPROVED when not in a payout. */
export const canApprove = (c: Commission) => c.status === 'PENDING'
export const canCancel = (c: Commission) =>
  (c.status === 'PENDING' || c.status === 'APPROVED') && c.payoutId === null

/** DRAFT → CONFIRMED → PAID. */
export const canConfirm = (p: Payout) => p.status === 'DRAFT'
export const canMarkPaid = (p: Payout) => p.status === 'CONFIRMED'
