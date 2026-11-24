import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  CommissionJob,
  type CreateCommissionJobData,
  QueueName,
} from '../queues/queues';
import { CommissionsService } from './commissions.service';

@Processor(QueueName.Commissions, { concurrency: 5 })
export class CommissionsProcessor extends WorkerHost {
  constructor(private readonly commissions: CommissionsService) {
    super();
  }

  async process(job: Job<CreateCommissionJobData>): Promise<unknown> {
    switch (job.name) {
      case CommissionJob.CreateForLead:
        return {
          result: await this.commissions.createForLead(job.data.leadId),
        };
      case CommissionJob.Reconcile:
        return { queued: await this.commissions.reconcile() };
      default:
        throw new Error(`Unknown commission job: ${job.name}`);
    }
  }
}
