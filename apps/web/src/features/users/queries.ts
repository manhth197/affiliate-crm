import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserQuery,
  usersApi,
} from '@/api/users'
import { catalogKeys } from '@/features/catalog/queries'

export const userKeys = {
  all: ['users'] as const,
  list: (query: UserQuery) => [...userKeys.all, 'list', query] as const,
}

export function useUsers(query: UserQuery) {
  return useQuery({
    queryKey: userKeys.list(query),
    queryFn: ({ signal }) => usersApi.list(query, signal),
    placeholderData: keepPreviousData,
  })
}

/** Staff changes also affect the "assign to" list (GET /staff). */
function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: userKeys.all })
    void queryClient.invalidateQueries({ queryKey: catalogKeys.staff() })
  }
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (body: CreateUserRequest) => usersApi.create(body),
    onSuccess: invalidate,
  })
}

export function useUpdateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserRequest }) =>
      usersApi.update(id, body),
    onSuccess: invalidate,
  })
}
