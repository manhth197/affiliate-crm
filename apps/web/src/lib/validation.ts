import { z } from 'zod'

/** Vietnamese mobile number: 0 or +84, then a 9-digit number starting with 3, 5, 7, 8 or 9. */
export const VN_PHONE_REGEX = /^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/

/** Strip spaces, dots and dashes users often type in phone numbers. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s.-]/g, '')
}

export const emailField = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập email')
  .pipe(z.email('Email không hợp lệ'))

export const phoneField = z
  .string()
  .transform(normalizePhone)
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
