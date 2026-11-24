import { Module } from '@nestjs/common';
import { LeadStatusService } from './lead-status.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, LeadStatusService],
  // The partner webhook (M3) changes status through the same service.
  exports: [LeadStatusService],
})
export class LeadsModule {}
