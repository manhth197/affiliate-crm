import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  type GeneratePayoutsJobData,
  PayoutJob,
  QueueName,
} from '../queues/queues';
import { type GenerateResult, PayoutsService } from './payouts.service';

// Concurrency 1: payout generation is rare and should never overlap.
@Processor(QueueName.Payouts, { concurrency: 1 })
export class PayoutsProcessor extends WorkerHost {
  constructor(private readonly payouts: PayoutsService) {
    super();
  }

  async process(job: Job<GeneratePayoutsJobData>): Promise<GenerateResult> {
    if (job.name !== PayoutJob.Generate) {
      throw new Error(`Unknown payout job: ${job.name}`);
    }
    return this.payouts.generate(job.data.month, job.data.requestedBy);
  }
}
