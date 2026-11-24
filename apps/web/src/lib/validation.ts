import { z } from 'zod'

/**
 * Vietnamese mobile number in local form (same pattern as the OpenAPI spec). Inputs like
 * "+84 912.345.678" are converted with `toLocalPhone` before this check.
 */
export const VN_PHONE_REGEX = /^0[35789]\d{8}$/

/** Strip spaces, dots and dashes users often type in phone numbers. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s.-]/g, '')
}

/** "+84 912.345.678" → "0912345678": the form the API stores and returns (contract v0.2). */
export function toLocalPhone(value: string): string {
  const compact = normalizePhone(value)
  return compact.startsWith('+84') ? `0${compact.slice(3)}` : compact
}

export const emailField = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập email')
  .pipe(z.email('Email không hợp lệ'))

export const phoneField = z
  .string()
  .transform(toLocalPhone)
  .pipe(
    z
      .string()
      .min(1, 'Vui lòng nhập số điện thoại')
      .regex(VN_PHONE_REGEX, 'Số điện thoại không hợp lệ (ví dụ: 0912345678)'),
  )

export const fullNameField = z
  .string()
  .trim()
  .min(2, 'Vui lòng nhập họ và tên')
  .max(100, 'Họ và tên tối đa 100 ký tự')

export const newPasswordField = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(72, 'Mật khẩu tối đa 72 ký tự')
