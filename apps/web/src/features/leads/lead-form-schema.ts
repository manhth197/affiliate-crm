import { z } from 'zod'
import type { CreateLeadRequest, Product } from '@/api/types'
import { phoneField } from '@/lib/validation'

export const MIN_LOAN_AMOUNT = 1_000_000
/** Same upper bound as the API (CreateLeadRequest.requestedAmount.maximum). */
export const MAX_LOAN_AMOUNT = 100_000_000_000

/**
 * Create-lead form rules. The schema needs the product list because the requested amount is
 * only asked (and required) for loan products.
 */
export function createLeadFormSchema(products: readonly Product[]) {
  return z
    .object({
      productId: z.string().min(1, 'Vui lòng chọn sản phẩm'),
      customerName: z
        .string()
        .trim()
        .min(2, 'Vui lòng nhập họ tên khách hàng')
        .max(100, 'Họ tên tối đa 100 ký tự'),
      customerPhone: phoneField,
      customerNationalId: z
        .string()
        .trim()
        .refine(
          (value) => value === '' || /^(\d{9}|\d{12})$/.test(value),
          'Số CMND/CCCD gồm 9 hoặc 12 chữ số',
        ),
      requestedAmount: z.number().int().optional(),
      note: z.string().trim().max(1000, 'Ghi chú tối đa 1.000 ký tự'),
    })
    .superRefine((values, ctx) => {
      const product = products.find((p) => p.id === values.productId)
      if (product?.category !== 'LOAN') return
      const amount = values.requestedAmount
      const message =
        amount === undefined
          ? 'Vui lòng nhập số tiền khách muốn vay'
          : amount < MIN_LOAN_AMOUNT
            ? 'Số tiền tối thiểu là 1.000.000 ₫'
            : amount > MAX_LOAN_AMOUNT
              ? 'Số tiền tối đa là 100.000.000.000 ₫'
              : null
      if (message) ctx.addIssue({ code: 'custom', path: ['requestedAmount'], message })
    })
}

export type LeadFormInput = z.input<ReturnType<typeof createLeadFormSchema>>
export type LeadFormValues = z.output<ReturnType<typeof createLeadFormSchema>>

/**
 * Build the API body. The API rejects unknown properties, so only filled fields are sent,
 * and the amount only for loans.
 */
export function toCreateLeadRequest(
  values: LeadFormValues,
  product: Product | undefined,
): CreateLeadRequest {
  return {
    productId: values.productId,
    customerName: values.customerName,
    customerPhone: values.customerPhone,
    ...(values.customerNationalId && { customerNationalId: values.customerNationalId }),
    ...(product?.category === 'LOAN' &&
      values.requestedAmount !== undefined && { requestedAmount: values.requestedAmount }),
    ...(values.note && { note: values.note }),
  }
}
