import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  catalogApi,
  type CreateProductRequest,
  type ProductQuery,
  type UpdateProductRequest,
} from '@/api/catalog'

export const catalogKeys = {
  all: ['products'] as const,
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

/** STAFF/ADMIN: who can be assigned a lead. */
export function useStaff({ enabled = true } = {}) {
  return useQuery({
    queryKey: catalogKeys.staff(),
    queryFn: ({ signal }) => catalogApi.staff(signal),
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateProductRequest) => catalogApi.createProduct(body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProductRequest }) =>
      catalogApi.updateProduct(id, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
  })
}
