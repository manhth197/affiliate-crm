import { Injectable, NotFoundException } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import { parseLeadCode } from '../leads/lead-code';
import { LeadStatusService } from '../leads/lead-status.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  PartnerStatusWebhookDto,
  WebhookAckDto,
} from './dto/partner-status-webhook.dto';
import type { PartnerWebhookConfig } from './partners';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statuses: LeadStatusService,
  ) {}

  async handlePartnerStatus(
    partner: PartnerWebhookConfig,
    dto: PartnerStatusWebhookDto,
  ): Promise<WebhookAckDto> {
    const leadId = await this.findPartnerLead(partner, dto.leadCode);
    try {
      await this.statuses.changeStatus(
        {
          leadId,
          to: dto.status,
          note: dto.note,
          disbursedAmount: dto.disbursedAmount,
          source: {
            kind: 'partner',
            partnerId: partner.id,
            eventId: dto.eventId,
          },
        },
        // Stored in the same transaction as the status change: if the change
        // fails (409, 422…) the event is not marked as processed and the
        // partner's retry is evaluated again. A concurrent duplicate blocks on
        // the unique index until the first one commits, then fails with P2002.
        async (tx) => {
          await tx.webhookEvent.create({
            data: {
              partnerId: partner.id,
              eventId: dto.eventId,
              payload: { ...dto },
              processedAt: new Date(),
            },
          });
        },
      );
    } catch (error) {
      if (isUniqueViolation(error, 'event_id')) {
        return { ok: true, duplicate: true };
      }
      throw error;
    }
    return { ok: true };
  }

  /**
   * A partner may only touch leads for its own products. Other partners'
   * leads get the same 404 as unknown codes, so nothing leaks.
   */
  private async findPartnerLead(
    partner: PartnerWebhookConfig,
    leadCode: string,
  ): Promise<string> {
    const number = parseLeadCode(leadCode);
    const lead =
      number === null
        ? null
        : await this.prisma.lead.findUnique({
            where: { number },
            select: { id: true, product: { select: { partnerName: true } } },
          });
    if (!lead || lead.product.partnerName !== partner.name) {
      throw new NotFoundException('Lead not found');
    }
    return lead.id;
  }
}
