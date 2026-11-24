import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { PageMetaDto } from '../../common/dto/pagination.dto';
import { LeadActivityType, LeadStatus } from '../../generated/prisma/enums';

@ApiSchema({ name: 'UserRef' })
export class UserRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** @example "Phạm Thu Hà" */
  fullName!: string;
}

@ApiSchema({ name: 'LeadAffiliate' })
export class LeadAffiliateDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** @example "Nguyễn Văn An" */
  fullName!: string;

  /** @example "CTVDEMA22" */
  referralCode!: string;
}

@ApiSchema({ name: 'LeadProduct' })
export class LeadProductDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** @example "Vay tiêu dùng tín chấp" */
  name!: string;

  /** @example "Tài chính An Phát" */
  partnerName!: string;
}

@ApiSchema({ name: 'Lead' })
export class LeadDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** @example "LD-000123" */
  code!: string;

  affiliate!: LeadAffiliateDto;

  product!: LeadProductDto;

  /** @example "Hoàng Thị Mai" */
  customerName!: string;

  /** Masked for AFFILIATE (first 2 + last 2 digits). @example "09******89" */
  customerPhone!: string;

  /** Masked for AFFILIATE (last 3 digits). @example "*********123" */
  customerNationalId!: string | null;

  /** VND, loans only. @example 50000000 */
  requestedAmount!: number | null;

  /** VND, set when the lead is DISBURSED. */
  disbursedAmount!: number | null;

  @ApiProperty({ enum: LeadStatus, enumName: 'LeadStatus' })
  status!: LeadStatus;

  @ApiProperty({ type: UserRefDto, nullable: true })
  assignedStaff!: UserRefDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

@ApiSchema({ name: 'PaginatedLeads' })
export class PaginatedLeadsDto {
  data!: LeadDto[];
  meta!: PageMetaDto;
}

@ApiSchema({ name: 'LeadActivity' })
export class LeadActivityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  leadId!: string;

  @ApiProperty({ enum: LeadActivityType, enumName: 'LeadActivityType' })
  type!: LeadActivityType;

  @ApiProperty({ enum: LeadStatus, enumName: 'LeadStatus', nullable: true })
  fromStatus!: LeadStatus | null;

  @ApiProperty({ enum: LeadStatus, enumName: 'LeadStatus', nullable: true })
  toStatus!: LeadStatus | null;

  note!: string | null;

  /** Null when the change came from a partner webhook. */
  @ApiProperty({ type: UserRefDto, nullable: true })
  actor!: UserRefDto | null;

  /** Set on ASSIGNED entries: who the lead was assigned to. */
  @ApiProperty({ type: UserRefDto, nullable: true })
  assignee!: UserRefDto | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
