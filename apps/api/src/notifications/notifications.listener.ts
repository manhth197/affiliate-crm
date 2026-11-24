import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CommissionCreatedEvent,
  CommissionEvents,
} from '../commissions/commission.events';
import {
  LeadAssignedEvent,
  LeadEvents,
  LeadStatusChangedEvent,
} from '../leads/lead.events';
import {
  commissionCreatedMessage,
  leadAssignedMessage,
  leadStatusChangedMessage,
  type NotificationMessage,
  payoutPaidMessage,
} from './notification-messages';
import { PayoutStatus } from '../generated/prisma/enums';
import {
  PayoutEvents,
  PayoutStatusChangedEvent,
} from '../payouts/payout.events';
import { NotificationsService } from './notifications.service';

/** Turns domain events into queued notifications. */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(LeadEvents.StatusChanged, { async: true })
  async onLeadStatusChanged(event: LeadStatusChangedEvent): Promise<void> {
    await this.enqueue(leadStatusChangedMessage(event));
  }

  @OnEvent(LeadEvents.Assigned, { async: true })
  async onLeadAssigned(event: LeadAssignedEvent): Promise<void> {
    if (event.staffId === event.actorId) {
      return; // no need to tell people what they just did themselves
    }
    await this.enqueue(leadAssignedMessage(event));
  }

  @OnEvent(CommissionEvents.Created, { async: true })
  async onCommissionCreated(event: CommissionCreatedEvent): Promise<void> {
    await this.enqueue(commissionCreatedMessage(event));
  }

  @OnEvent(PayoutEvents.StatusChanged, { async: true })
  async onPayoutStatusChanged(event: PayoutStatusChangedEvent): Promise<void> {
    if (event.status === PayoutStatus.PAID) {
      await this.enqueue(payoutPaidMessage(event));
    }
  }

  /** A notification must never break the request that triggered it. */
  private async enqueue(message: NotificationMessage): Promise<void> {
    try {
      await this.notifications.enqueue(message);
    } catch (error) {
      this.logger.error(
        `Could not queue ${message.type} for user ${message.userId}: ${String(error)}`,
      );
    }
  }
}
