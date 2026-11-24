import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/env.validation';
import { parsePartnerWebhooks, type PartnerWebhookConfig } from './partners';

/** Partners allowed to call the webhook, from PARTNER_WEBHOOKS (validated at startup). */
@Injectable()
export class PartnersService {
  private readonly partners: Map<string, PartnerWebhookConfig>;

  constructor(config: ConfigService<AppConfig, true>) {
    const list = parsePartnerWebhooks(
      config.get('PARTNER_WEBHOOKS', { infer: true }),
    );
    this.partners = new Map(list.map((p) => [p.id, p]));
  }

  find(id: string): PartnerWebhookConfig | undefined {
    return this.partners.get(id);
  }
}
