import { ApiProperty, ApiSchema, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/validation/transforms';
import { CommissionType, ProductCategory } from '../../generated/prisma/enums';
import { MAX_FIXED_COMMISSION_VND } from '../commission-rule';

@ApiSchema({ name: 'CreateProductRequest' })
export class CreateProductDto {
  /** @example "Vay tiêu dùng tín chấp" */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  /** @example "Tài chính An Phát" */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  partnerName!: string;

  @ApiProperty({ enum: ProductCategory, enumName: 'ProductCategory' })
  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @ApiProperty({ enum: CommissionType, enumName: 'CommissionType' })
  @IsEnum(CommissionType)
  commissionType!: CommissionType;

  /**
   * PERCENT: basis points, 0–10000 (150 = 1.5%). FIXED: VND, 0–1,000,000,000.
   * @example 150
   */
  @IsInt()
  @Min(0)
  @Max(MAX_FIXED_COMMISSION_VND)
  commissionValue!: number;

  /** Defaults to true. */
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@ApiSchema({ name: 'UpdateProductRequest' })
export class UpdateProductDto extends PartialType(CreateProductDto) {}
