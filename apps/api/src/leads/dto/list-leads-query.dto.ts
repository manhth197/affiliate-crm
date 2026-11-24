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
  UNASSIGNED,
} from '../lead-filters';

/** A UUID, or the literal "none" (unassigned). */
const UUID_OR_NONE_PATTERN = new RegExp(
  `^(${UNASSIGNED}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
  'i',
);

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

  /** A staff user id, or `none` for leads nobody has been assigned. */
  @ApiProperty({ required: false, pattern: UUID_OR_NONE_PATTERN.source })
  @IsOptional()
  @Matches(UUID_OR_NONE_PATTERN, { message: 'must be a UUID or "none"' })
  assignedStaffId?: string;

  /** Customer name (case- and accent-insensitive), lead code (LD-000123) or 3+ phone digits. */
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
