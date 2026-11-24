import {
  ApiProperty,
  type ApiPropertyOptions,
  ApiSchema,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsIsoDateTime } from '../../common/dates';
import { CommissionStatus, LeadStatus } from '../../generated/prisma/enums';
import { LeadAffiliateDto } from '../../leads/dto/lead.dto';

export class ReportRangeQueryDto {
  /** Inclusive. ISO datetime with timezone. Default: start of the Vietnam day 29 days before `to`. */
  @IsOptional()
  @IsIsoDateTime()
  from?: string;

  /** Exclusive. ISO datetime with timezone. Default: now. */
  @IsOptional()
  @IsIsoDateTime()
  to?: string;
}

export class TopAffiliatesQueryDto extends ReportRangeQueryDto {
  /** 1–50 */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}

/** Swagger schema for `Record<Enum, number>`: one required integer per enum value. */
function recordOf(
  keys: readonly string[],
  description: string,
): ApiPropertyOptions {
  const properties: Record<string, { type: 'integer' }> = {};
  for (const key of keys) {
    properties[key] = { type: 'integer' };
  }
  return {
    type: 'object',
    description,
    properties,
    required: [...keys],
    additionalProperties: false,
  };
}

@ApiSchema({ name: 'LeadsPerDay' })
export class LeadsPerDayDto {
  /** Vietnam calendar day. @example "2026-11-24" */
  date!: string;
  count!: number;
}

@ApiSchema({ name: 'ReportOverview' })
export class ReportOverviewDto {
  @ApiProperty(
    recordOf(
      Object.values(LeadStatus),
      'Number of leads created in [from, to), by current status',
    ),
  )
  leadsByStatus!: Record<LeadStatus, number>;

  /** DISBURSED ÷ all leads created in the range, 0..1 (4 decimals). @example 0.2083 */
  conversionRate!: number;

  /** VND disbursed for leads created in the range. */
  disbursedAmount!: number;

  @ApiProperty(
    recordOf(
      Object.values(CommissionStatus),
      'Commission amounts in VND (sum) for commissions created in [from, to), by status',
    ),
  )
  commissionByStatus!: Record<CommissionStatus, number>;

  /** One entry per Vietnam calendar day in the range (0 when no leads). */
  leadsPerDay!: LeadsPerDayDto[];
}

@ApiSchema({ name: 'TopAffiliate' })
export class TopAffiliateDto {
  affiliate!: LeadAffiliateDto;
  /** Leads created in the range. */
  leads!: number;
  /** Of those, how many are DISBURSED. */
  disbursed!: number;
  /** VND, commissions created in the range, excluding CANCELLED. */
  commission!: number;
}
