export const CommissionEvents = {
  Created: 'commission.created',
} as const;

export class CommissionCreatedEvent {
  constructor(
    readonly commissionId: string,
    readonly affiliateId: string,
    readonly leadId: string,
    readonly leadCode: string,
    /** VND */
    readonly amount: number,
  ) {}
}
