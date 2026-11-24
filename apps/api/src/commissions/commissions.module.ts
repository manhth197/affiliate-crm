import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QueueName } from '../queues/queues';
import { CommissionsController } from './commissions.controller';
import { CommissionsListener } from './commissions.listener';
import { CommissionsProcessor } from './commissions.processor';
import { CommissionsService } from './commissions.service';

@Module({
  imports: [BullModule.registerQueue({ name: QueueName.Commissions })],
  controllers: [CommissionsController],
  providers: [CommissionsService, CommissionsProcessor, CommissionsListener],
  exports: [CommissionsService],
})
export class CommissionsModule {}
