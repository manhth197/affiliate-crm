import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ApiErrors } from '../common/errors/api-errors.decorator';
import {
  PartnerStatusWebhookDto,
  WebhookAckDto,
} from './dto/partner-status-webhook.dto';
import {
  type PartnerRequest,
  PartnerSignatureGuard,
} from './partner-signature.guard';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  /** No JWT: the partner authenticates with an HMAC signature instead. */
  @Public()
  @Post('partner-status')
  @UseGuards(PartnerSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lead status update pushed by a partner (signed)',
    description:
      'X-Signature = hex HMAC-SHA256 of `${X-Timestamp}.${rawBody}` with the partner secret. ' +
      'Timestamps older than 5 minutes are rejected. A repeated eventId returns {ok: true, duplicate: true}.',
  })
  @ApiHeader({ name: 'X-Partner-Id', required: true, example: 'an-phat' })
  @ApiHeader({
    name: 'X-Timestamp',
    required: true,
    description: 'Unix time in seconds',
  })
  @ApiHeader({
    name: 'X-Signature',
    required: true,
    description: 'Hex HMAC-SHA256',
  })
  @ApiOkResponse({ type: WebhookAckDto })
  @ApiErrors(400, 401, 404, 409, 422)
  partnerStatus(
    @Req() request: PartnerRequest,
    @Body() dto: PartnerStatusWebhookDto,
  ): Promise<WebhookAckDto> {
    // The guard has verified the signature and attached the partner.
    return this.webhooks.handlePartnerStatus(request.partner!, dto);
  }
}
