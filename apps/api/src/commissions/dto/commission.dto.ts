import { ApiProperty, ApiSchema, IntersectionType } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsMonth } from '../../common/dates';
import {
  PageMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { Trim } from '../../common/validation/transforms';
import { CommissionStatus } from '../../generated/prisma/enums';
import { UserRefDto } from '../../leads/dto/lead.dto';

@ApiSchema({ name: 'CommissionLead' })
export class CommissionLeadDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** @example "LD-000123" */
  code!: string;

  /** @example "Hoàng Thị Mai" */
  customerName!: string;
}

@ApiSchema({ name: 'Commission' })
export class CommissionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  lead!: CommissionLeadDto;

  affiliate!: UserRefDto;

  /** VND @example 750000 */
  amount!: number;

  @ApiProperty({ enum: CommissionStatus, enumName: 'CommissionStatus' })
  status!: CommissionStatus;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  payoutId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

@ApiSchema({ name: 'PaginatedCommissions' })
export class PaginatedCommissionsDto {
  data!: CommissionDto[];
  meta!: PageMetaDto;
}

/** Totals for the logged-in affiliate (amounts in VND). */
@ApiSchema({ name: 'CommissionSummary' })
export class CommissionSummaryDto {
  /** @example 750000 */
  pending!: number;
  approved!: number;
  paid!: number;
  totalLeads!: number;
  disbursedLeads!: number;
}

class CommissionFiltersDto {
  @ApiProperty({
    enum: CommissionStatus,
    enumName: 'CommissionStatus',
    required: false,
  })
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  /** Ignored for affiliates (they only see their own commissions). */
  @IsOptional()
  @IsUUID()
  affiliateId?: string;

  /** Month the commission was created, Vietnam calendar. @example "2026-11" */
  @IsOptional()
  @IsMonth()
  month?: string;
}

export class ListCommissionsQueryDto extends IntersectionType(
  CommissionFiltersDto,
  PaginationQueryDto,
) {}

@ApiSchema({ name: 'CancelCommissionRequest' })
export class CancelCommissionDto {
  /** @example "Khách hàng huỷ hợp đồng trong 15 ngày" */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
