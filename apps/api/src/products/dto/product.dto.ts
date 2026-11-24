import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { CommissionType, ProductCategory } from '../../generated/prisma/enums';

@ApiSchema({ name: 'Product' })
export class ProductDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  /** @example "Vay tiêu dùng tín chấp" */
  name!: string;

  /** @example "Tài chính An Phát" */
  partnerName!: string;

  @ApiProperty({ enum: ProductCategory, enumName: 'ProductCategory' })
  category!: ProductCategory;

  @ApiProperty({ enum: CommissionType, enumName: 'CommissionType' })
  commissionType!: CommissionType;

  /** PERCENT: basis points (150 = 1.5%). FIXED: VND. @example 150 */
  commissionValue!: number;

  active!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}
