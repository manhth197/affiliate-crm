import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import type { Queue } from 'bullmq';
import type { AppConfig } from '../config/env.validation';
import { LeadStatus } from '../generated/prisma/enums';
import { LeadEvents, LeadStatusChangedEvent } from '../leads/lead.events';
import { CommissionJob, QueueName } from '../queues/queues';
import { CommissionsService } from './commissions.service';

const RECONCILE_SCHEDULER_ID = 'commission-reconcile';

/**
 * Starts commission work: one job when a lead is disbursed, plus a periodic
 * reconcile job (BullMQ job scheduler) that catches anything missed.
 */
@Injectable()
export class CommissionsListener implements OnApplicationBootstrap {
  private readonly logger = new Logger(CommissionsListener.name);

  constructor(
    private readonly commissions: CommissionsService,
    private readonly config: ConfigService<AppConfig, true>,
    @InjectQueue(QueueName.Commissions) private readonly queue: Queue,
  ) {}

  @OnEvent(LeadEvents.StatusChanged, { async: true })
  async onLeadStatusChanged(event: LeadStatusChangedEvent): Promise<void> {
    if (event.to !== LeadStatus.DISBURSED) {
      return;
    }
    try {
      await this.commissions.enqueueForLead(event.leadId);
    } catch (error) {
      // The reconcile job will pick this lead up later.
      this.logger.error(
        `Could not queue commission for lead ${event.leadId}: ${String(error)}`,
      );
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    const minutes = this.config.get('COMMISSION_RECONCILE_MINUTES', {
      infer: true,
    });
    try {
      if (minutes === 0) {
        await this.queue.removeJobScheduler(RECONCILE_SCHEDULER_ID);
        return;
      }
      // Upsert: every API instance can call this; Redis keeps one schedule.
      await this.queue.upsertJobScheduler(
        RECONCILE_SCHEDULER_ID,
        { every: minutes * 60 * 1000 },
        { name: CommissionJob.Reconcile },
      );
    } catch (error) {
      this.logger.warn(
        `Could not set up commission reconcile: ${String(error)}`,
      );
    }
  }
}
