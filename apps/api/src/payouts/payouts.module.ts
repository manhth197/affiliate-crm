import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QueueName } from '../queues/queues';
import { PayoutsController } from './payouts.controller';
import { PayoutsProcessor } from './payouts.processor';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: QueueName.Payouts,
      defaultJobOptions: { attempts: 3 },
    }),
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService, PayoutsProcessor],
})
export class PayoutsModule {}
