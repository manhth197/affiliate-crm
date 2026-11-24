import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsIsoDateTime } from '../../common/dates';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Trim } from '../../common/validation/transforms';
import { LeadStatus } from '../../generated/prisma/enums';
import {
  DEFAULT_LEAD_SORT,
  LEAD_SORT_FIELDS,
  LEAD_SORT_PATTERN,
} from '../lead-filters';

export class LeadFiltersDto {
  @ApiProperty({ enum: LeadStatus, enumName: 'LeadStatus', required: false })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsUUID()
  productId?: string;

  /** Ignored for affiliates (they only see their own leads). */
  @IsOptional()
  @IsUUID()
  affiliateId?: string;

  @IsOptional()
  @IsUUID()
  assignedStaffId?: string;

  /** Customer name, lead code (LD-000123) or phone digits. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** createdAt ≥ from. ISO datetime with timezone, e.g. 2026-11-01T00:00:00+07:00 */
  @IsOptional()
  @IsIsoDateTime()
  from?: string;

  /** createdAt < to (exclusive). ISO datetime with timezone. */
  @IsOptional()
  @IsIsoDateTime()
  to?: string;

  @ApiProperty({
    required: false,
    default: DEFAULT_LEAD_SORT,
    description: `field:direction, field one of ${LEAD_SORT_FIELDS.join(', ')}`,
    example: 'createdAt:desc',
  })
  @IsOptional()
  @Matches(LEAD_SORT_PATTERN, {
    message: `must be one of ${LEAD_SORT_FIELDS.join(', ')} followed by :asc or :desc`,
  })
  sort?: string;
}

export class ListLeadsQueryDto extends IntersectionType(
  LeadFiltersDto,
  PaginationQueryDto,
) {}
