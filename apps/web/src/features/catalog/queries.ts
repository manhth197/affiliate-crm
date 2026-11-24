import { useQuery } from '@tanstack/react-query'
import { catalogApi, type ProductQuery } from '@/api/catalog'

export const catalogKeys = {
  products: (query: ProductQuery = {}) => ['products', query] as const,
  staff: () => ['staff'] as const,
}

export function useProducts(query: ProductQuery = {}) {
  return useQuery({
    queryKey: catalogKeys.products(query),
    queryFn: ({ signal }) => catalogApi.products(query, signal),
    // The product catalogue rarely changes.
    staleTime: 5 * 60_000,
  })
}
