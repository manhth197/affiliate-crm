import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/validation/transforms';
import { IsVnPhone, VN_MOBILE_PATTERN } from '../../common/validation/vn-phone';
import { LeadStatus } from '../../generated/prisma/enums';

/** 100 billion VND: generous upper bound that catches typos (extra zeros). */
export const MAX_AMOUNT_VND = 100_000_000_000;
/** Old 9-digit CMND or 12-digit CCCD. */
export const NATIONAL_ID_PATTERN = /^(\d{9}|\d{12})$/;

@ApiSchema({ name: 'CreateLeadRequest' })
export class CreateLeadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  /** @example "Hoàng Thị Mai" */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  customerName!: string;

  @ApiProperty({ example: '0987654321', pattern: VN_MOBILE_PATTERN.source })
  @IsVnPhone()
  customerPhone!: string;

  /** 9-digit CMND or 12-digit CCCD. @example "001203004123" */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\s/g, '') : value,
  )
  @Matches(NATIONAL_ID_PATTERN, {
    message: 'must be a 9-digit CMND or 12-digit CCCD number',
  })
  customerNationalId?: string;

  /** VND; only for LOAN products. @example 50000000 */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_AMOUNT_VND)
  requestedAmount?: number;

  /** Free text from the affiliate, shown in the timeline. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiSchema({ name: 'ChangeLeadStatusRequest' })
export class ChangeLeadStatusDto {
  @ApiProperty({ enum: LeadStatus, enumName: 'LeadStatus' })
  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** VND. Required when status is DISBURSED, not allowed otherwise. */
  @ApiProperty({ required: false, example: 50000000 })
  @ValidateIf((dto: ChangeLeadStatusDto) => dto.status === LeadStatus.DISBURSED)
  @IsInt({ message: 'is required (integer VND) when status is DISBURSED' })
  @Min(0)
  @Max(MAX_AMOUNT_VND)
  disbursedAmount?: number;
}

@ApiSchema({ name: 'AssignLeadRequest' })
export class AssignLeadDto {
  /** An active STAFF or ADMIN user (see GET /staff). */
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  staffId!: string;
}

@ApiSchema({ name: 'AddLeadNoteRequest' })
export class AddLeadNoteDto {
  /** @example "Khách hẹn gọi lại sau 17h" */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note!: string;
}
