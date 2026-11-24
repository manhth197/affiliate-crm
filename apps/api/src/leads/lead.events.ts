import type { LeadStatus } from '../generated/prisma/enums';

/**
 * In-process domain events, emitted after the DB transaction commits.
 * Listeners (M3) turn them into BullMQ jobs, notifications and Socket.IO
 * messages, so the lead code does not depend on any of those.
 */
export const LeadEvents = {
  Created: 'lead.created',
  StatusChanged: 'lead.status_changed',
  Assigned: 'lead.assigned',
} as const;

export class LeadCreatedEvent {
  constructor(
    readonly leadId: string,
    readonly leadCode: string,
    readonly affiliateId: string,
  ) {}
}

export class LeadStatusChangedEvent {
  constructor(
    readonly leadId: string,
    readonly leadCode: string,
    readonly affiliateId: string,
    readonly from: LeadStatus,
    readonly to: LeadStatus,
    /** Null when the change came from a partner webhook. */
    readonly actorId: string | null,
    readonly occurredAt: Date,
  ) {}
}

export class LeadAssignedEvent {
  constructor(
    readonly leadId: string,
    readonly leadCode: string,
    readonly staffId: string,
    readonly actorId: string,
  ) {}
}
