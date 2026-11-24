import { tz } from '@date-fns/tz'
import { format, formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

/** All dates are shown in Vietnam time, whatever the browser's time zone is. */
export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const inVietnam = tz(VN_TIME_ZONE)

/** Non-breaking space, so "1.500.000 ₫" never wraps before the symbol. */
export const NBSP = String.fromCharCode(160)

const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

/** 1500000 → "1.500.000 ₫" (non-breaking space before the symbol so it never wraps). */
export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  return `${numberFormat.format(amount)}${NBSP}₫`
}

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** 0.1234 → "12,3%" */
export function formatPercent(ratio: number, fractionDigits = 1): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'percent',
    maximumFractionDigits: fractionDigits,
  }).format(ratio)
}

/** ISO string → "24/11/2026" (Vietnam time). */
export function formatDate(iso: string): string {
  return format(new Date(iso), 'dd/MM/yyyy', { in: inVietnam })
}

/** ISO string → "24/11/2026 14:05" (Vietnam time). */
export function formatDateTime(iso: string): string {
  return format(new Date(iso), 'dd/MM/yyyy HH:mm', { in: inVietnam })
}

/** ISO string → "5 phút trước". */
export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: vi })
}

/** "Nguyễn Văn An" → "NA" (first letter of the first and last word). */
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0]?.[0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
