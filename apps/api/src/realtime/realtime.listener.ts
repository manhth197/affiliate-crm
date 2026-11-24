import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Role } from '../generated/prisma/enums';
import { LeadEvents, LeadStatusChangedEvent } from '../leads/lead.events';
import {
  RealtimeEvent,
  RealtimeGateway,
  roleRoom,
  userRoom,
} from './realtime.gateway';

/** Pushes `lead:updated` to the owner and to every staff/admin screen. */
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
}
