import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isApiError } from '@/api/errors'

/**
 * Copy the API's 400 `details` onto matching form fields. The API speaks English, so the
 * user sees a Vietnamese generic message on the field. Returns true if any field matched.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
): boolean {
  if (!isApiError(error) || error.status !== 400) return false
  let matched = false
  for (const detail of error.details) {
    const field = fields.find((name) => name === detail.field)
    if (field) {
      setError(field, { type: 'server', message: 'Giá trị không hợp lệ' })
      matched = true
    }
  }
  return matched
}
