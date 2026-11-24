/** BullMQ queue names (one per kind of background work). */
export const QueueName = {
  Commissions: 'commissions',
  Payouts: 'payouts',
  Notifications: 'notifications',
} as const;

export const CommissionJob = {
  /** { leadId } — create the commission for a DISBURSED lead (idempotent). */
  CreateForLead: 'create-for-lead',
  /** Safety net: re-enqueue DISBURSED leads that have no commission yet. */
  Reconcile: 'reconcile',
} as const;

export const NotificationJob = {
  /** NotificationMessage — store it and push it over Socket.IO. */
  Send: 'send',
} as const;

export interface CreateCommissionJobData {
  leadId: string;
}
