import { apiRequest } from './client'
import type { Product, ProductCategory, StaffMember } from './types'

export type ProductQuery = { active?: boolean; category?: ProductCategory }

export const catalogApi = {
  /** Affiliates always get active products only. */
  products: (query: ProductQuery = {}, signal?: AbortSignal) =>
    apiRequest<Product[]>('/products', { query, signal }),

  /** STAFF and ADMIN: people who can be assigned leads. */
  staff: (signal?: AbortSignal) => apiRequest<StaffMember[]>('/staff', { signal }),
}
