import { apiRequest } from './client'
import type { Product, ProductCategory, StaffMember } from './types'
import type { components } from './schema.gen'

export type CreateProductRequest = components['schemas']['CreateProductRequest']
export type UpdateProductRequest = components['schemas']['UpdateProductRequest']

export type ProductQuery = { active?: boolean; category?: ProductCategory }

export const catalogApi = {
  /** Affiliates always get active products only. */
  products: (query: ProductQuery = {}, signal?: AbortSignal) =>
    apiRequest<Product[]>('/products', { query, signal }),

  /** STAFF and ADMIN: people who can be assigned leads. */
  staff: (signal?: AbortSignal) => apiRequest<StaffMember[]>('/staff', { signal }),

  /** ADMIN. */
  createProduct: (body: CreateProductRequest) =>
    apiRequest<Product>('/products', { method: 'POST', body }),

  /** ADMIN. Partial update. */
  updateProduct: (id: string, body: UpdateProductRequest) =>
    apiRequest<Product>(`/products/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
}
