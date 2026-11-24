import type {
  CommissionStatus,
  CommissionType,
  LeadStatus,
  PayoutStatus,
  ProductCategory,
  UserStatus,
} from '@/api/types'
import { formatVnd } from './format'

const percentFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'Mới',
  CONTACTED: 'Đã liên hệ',
  SUBMITTED: 'Đã nộp hồ sơ',
  APPROVED: 'Đã duyệt',
  DISBURSED: 'Đã giải ngân',
  REJECTED: 'Từ chối',
}

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã hủy',
}

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  DRAFT: 'Nháp',
  CONFIRMED: 'Đã xác nhận',
  PAID: 'Đã thanh toán',
}

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  LOAN: 'Vay',
  CREDIT_CARD: 'Thẻ tín dụng',
  INSURANCE: 'Bảo hiểm',
}

/** PERCENT is in basis points: 150 → "1,5% số tiền giải ngân"; FIXED → "300.000 ₫ / hồ sơ". */
export function describeCommission(type: CommissionType, value: number): string {
  if (type === 'PERCENT') {
    return `${percentFormat.format(value / 100)}% số tiền giải ngân`
  }
  return `${formatVnd(value)} / hồ sơ thành công`
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Hoạt động',
  DISABLED: 'Đã khóa',
}
