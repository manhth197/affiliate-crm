import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ToBoolean } from '../../common/validation/transforms';
import { ProductCategory } from '../../generated/prisma/enums';

export class ListProductsQueryDto {
  /** Ignored for affiliates: they only ever see active products. */
  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({
    enum: ProductCategory,
    enumName: 'ProductCategory',
    required: false,
  })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;
}
