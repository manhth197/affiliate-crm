import type { PayoutStatus } from '../generated/prisma/enums';

export const PayoutEvents = {
  StatusChanged: 'payout.status_changed',
} as const;

/** Emitted after COMMIT whenever a payout is created (DRAFT) or changes status. */
export class PayoutStatusChangedEvent {
  constructor(
    readonly payoutId: string,
    readonly affiliateId: string,
    readonly periodMonth: string,
    readonly status: PayoutStatus,
    /** VND */
    readonly totalAmount: number,
    readonly commissionCount: number,
  ) {}
}
