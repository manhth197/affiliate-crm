import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Role } from '../generated/prisma/enums';
import { LeadEvents, LeadStatusChangedEvent } from '../leads/lead.events';
import {
  PayoutEvents,
  PayoutStatusChangedEvent,
} from '../payouts/payout.events';
import {
  RealtimeEvent,
  RealtimeGateway,
  roleRoom,
  userRoom,
} from './realtime.gateway';

/** Pushes live updates (`lead:updated`, `payout:updated`) to the right rooms. */
@Injectable()
export class RealtimeListener {
  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(LeadEvents.StatusChanged)
  onLeadStatusChanged(event: LeadStatusChangedEvent): void {
    this.gateway.emitToRooms(
      [userRoom(event.affiliateId), roleRoom(Role.STAFF), roleRoom(Role.ADMIN)],
      RealtimeEvent.LeadUpdated,
      {
        leadId: event.leadId,
        status: event.to,
        updatedAt: event.occurredAt.toISOString(),
      },
    );
  }

  @OnEvent(PayoutEvents.StatusChanged)
  onPayoutStatusChanged(event: PayoutStatusChangedEvent): void {
    this.gateway.emitToRooms(
      [userRoom(event.affiliateId), roleRoom(Role.ADMIN)],
      RealtimeEvent.PayoutUpdated,
      { payoutId: event.payoutId, status: event.status },
    );
  }
}
