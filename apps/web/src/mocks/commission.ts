import type { Product } from '@/api/types'

/**
 * Commission rule from ARCHITECTURE.md: PERCENT is in basis points of the disbursed amount
 * (150 = 1.5%), FIXED is a VND amount. Rounded to whole VND.
 */
export function commissionFor(
  product: Pick<Product, 'commissionType' | 'commissionValue'>,
  disbursedAmount: number,
): number {
  if (product.commissionType === 'FIXED') return product.commissionValue
  return Math.round((disbursedAmount * product.commissionValue) / 10_000)
}
