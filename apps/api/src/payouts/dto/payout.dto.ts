import { ApiProperty, ApiSchema, IntersectionType } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IsMonth } from '../../common/dates';
import {
  PageMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PayoutStatus } from '../../generated/prisma/enums';
import { UserRefDto } from '../../leads/dto/lead.dto';

@ApiSchema({ name: 'Payout' })
export class PayoutDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  affiliate!: UserRefDto;

  /** Vietnam calendar month. @example "2026-11" */
  periodMonth!: string;

  /** VND @example 1500000 */
  totalAmount!: number;

  commissionCount!: number;

  @ApiProperty({ enum: PayoutStatus, enumName: 'PayoutStatus' })
  status!: PayoutStatus;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  paidAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

@ApiSchema({ name: 'PaginatedPayouts' })
export class PaginatedPayoutsDto {
  data!: PayoutDto[];
  meta!: PageMetaDto;
}

class PayoutFiltersDto {
  @ApiProperty({
    enum: PayoutStatus,
    enumName: 'PayoutStatus',
    required: false,
  })
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;

  /** @example "2026-11" */
  @IsOptional()
  @IsMonth()
  month?: string;

  /** Ignored for affiliates (they only see their own payouts). */
  @IsOptional()
  @IsUUID()
  affiliateId?: string;
}

export class ListPayoutsQueryDto extends IntersectionType(
  PayoutFiltersDto,
  PaginationQueryDto,
) {}

@ApiSchema({ name: 'GeneratePayoutsRequest' })
export class GeneratePayoutsDto {
  /** Month whose APPROVED commissions are paid out (Vietnam calendar). @example "2026-11" */
  @IsMonth()
  month!: string;
}

@ApiSchema({ name: 'JobAccepted' })
export class JobAcceptedDto {
  /** BullMQ job id. */
  jobId!: string;
}
