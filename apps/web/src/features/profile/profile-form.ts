import { z } from 'zod'
import type { Me, UpdateMeRequest } from '@/api/types'
import { fullNameField, phoneField } from '@/lib/validation'

export const schema = z.object({
  fullName: fullNameField,
  phone: phoneField,
  bankName: z.string().trim().max(100, 'Tối đa 100 ký tự'),
  /** Empty = keep the current account. Spaces are allowed while typing. */
  bankAccountNumber: z
    .string()
    .transform((value) => value.replace(/\s/g, ''))
    .refine((value) => value === '' || /^\d{6,20}$/.test(value), 'Số tài khoản gồm 6–20 chữ số'),
})
export type FormInput = z.input<typeof schema>
export type FormOutput = z.output<typeof schema>
export const FIELDS = ['fullName', 'phone', 'bankName', 'bankAccountNumber'] as const

/** Send only what changed; bank fields only for affiliates (the API answers 403 otherwise). */
export function toUpdateMeRequest(values: FormOutput, user: Me): UpdateMeRequest {
  const body: UpdateMeRequest = {}
  if (values.fullName !== user.fullName) body.fullName = values.fullName
  if (values.phone !== user.phone) body.phone = values.phone
  if (user.affiliate) {
    if (values.bankName && values.bankName !== (user.affiliate.bankName ?? '')) {
      body.bankName = values.bankName
    }
    if (values.bankAccountNumber) body.bankAccountNumber = values.bankAccountNumber
  }
  return body
}
