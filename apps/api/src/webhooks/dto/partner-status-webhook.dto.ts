import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LeadStatus } from '../../generated/prisma/enums';
import { MAX_AMOUNT_VND } from '../../leads/dto/lead-requests.dto';

const PARTNER_STATUSES = [
  LeadStatus.APPROVED,
  LeadStatus.REJECTED,
  LeadStatus.DISBURSED,
] as const;

@ApiSchema({ name: 'PartnerStatusWebhookRequest' })
export class PartnerStatusWebhookDto {
  /** Partner's unique id for this event; repeats are acknowledged, not re-applied. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  eventId!: string;

  /** @example "LD-000123" */
  @Matches(/^LD-\d{6,9}$/, { message: 'must look like LD-000123' })
  leadCode!: string;

  @ApiProperty({ enum: PARTNER_STATUSES })
  @IsIn(PARTNER_STATUSES)
  status!: 'APPROVED' | 'REJECTED' | 'DISBURSED';

  /** VND; required when status is DISBURSED. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_AMOUNT_VND)
  disbursedAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiSchema({ name: 'WebhookAck' })
export class WebhookAckDto {
  ok!: boolean;
  /** true when this eventId was already processed (nothing changed). */
  duplicate?: boolean;
}
