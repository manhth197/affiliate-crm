import type { Product } from '../generated/prisma/client';
import type { ProductDto } from './dto/product.dto';

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id,
    name: product.name,
    partnerName: product.partnerName,
    category: product.category,
    commissionType: product.commissionType,
    commissionValue: product.commissionValue,
    active: product.active,
    createdAt: product.createdAt.toISOString(),
  };
}
