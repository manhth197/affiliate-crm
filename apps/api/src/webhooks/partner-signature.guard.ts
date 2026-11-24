import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  type RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { isFreshTimestamp, isValidSignature } from './hmac';
import type { PartnerWebhookConfig } from './partners';
import { PartnersService } from './partners.service';

export type PartnerRequest = RawBodyRequest<Request> & {
  partner?: PartnerWebhookConfig;
};

/**
 * Authenticates a partner webhook before the body is even validated:
 * known partner id, timestamp within 5 minutes, and an HMAC over the exact
 * bytes received (`rawBody`), not over re-serialised JSON.
 * Every failure is the same 401 so callers learn nothing about which check failed.
 */
@Injectable()
export class PartnerSignatureGuard implements CanActivate {
  constructor(private readonly partners: PartnersService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PartnerRequest>();
    const partnerId = request.header('x-partner-id') ?? '';
    const timestamp = request.header('x-timestamp') ?? '';
    const signature = request.header('x-signature') ?? '';

    const partner = this.partners.find(partnerId);
    const ok =
      partner !== undefined &&
      request.rawBody !== undefined &&
      isFreshTimestamp(timestamp) &&
      isValidSignature(partner.secret, timestamp, request.rawBody, signature);
    if (!ok) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    request.partner = partner;
    return true;
  }
}
