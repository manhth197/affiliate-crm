import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { PartnerSignatureGuard } from './partner-signature.guard';
import { PartnersService } from './partners.service';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [LeadsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, PartnersService, PartnerSignatureGuard],
})
export class WebhooksModule {}
