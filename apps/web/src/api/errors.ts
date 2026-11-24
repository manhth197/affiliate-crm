import type { ApiErrorBody, ApiErrorCode } from './types'

/** Error thrown by the API client for any non-2xx response (status 0 = network failure). */
export class ApiError extends Error {
  readonly status: number
  /** Machine-readable business error code, e.g. "DUPLICATE_LEAD". */
  readonly code: ApiErrorCode | undefined
  readonly details: { field: string; message: string }[]

  constructor(status: number, body?: Partial<ApiErrorBody>) {
    super(body?.message ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = body?.code
    this.details = body?.details ?? []
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** The API speaks English; the user sees these. Business codes win over status codes. */
const MESSAGES_BY_CODE: Record<ApiErrorCode, string> = {
  ACCOUNT_DISABLED: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.',
  EMAIL_TAKEN: 'Email này đã được đăng ký.',
  DUPLICATE_LEAD: 'Khách hàng này đã có hồ sơ đang xử lý cho sản phẩm này.',
  INVALID_TRANSITION: 'Không thể chuyển sang trạng thái này từ trạng thái hiện tại.',
  CONCURRENT_UPDATE:
    'Lead vừa được người khác cập nhật. Dữ liệu đã được tải lại, vui lòng thử lại.',
  PRODUCT_UNAVAILABLE: 'Sản phẩm này hiện không nhận hồ sơ. Vui lòng chọn sản phẩm khác.',
  AMOUNT_NOT_ALLOWED: 'Sản phẩm này không cần nhập số tiền vay.',
  ASSIGNEE_NOT_STAFF: 'Chỉ có thể giao lead cho nhân viên hoặc quản trị viên đang hoạt động.',
  CANNOT_DISABLE_SELF: 'Bạn không thể tự khóa tài khoản của mình.',
  DISBURSED_AMOUNT_REQUIRED: 'Cần có số tiền giải ngân để chuyển sang “Đã giải ngân”.',
  INVALID_COMMISSION_STATUS:
    'Hoa hồng này không còn ở trạng thái cho phép thao tác. Vui lòng tải lại.',
  INVALID_PAYOUT_STATUS:
    'Kỳ chi trả này không còn ở trạng thái cho phép thao tác. Vui lòng tải lại.',
}

const MESSAGES_BY_STATUS: Record<number, string> = {
  0: 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.',
  400: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.',
  401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu.',
  409: 'Dữ liệu đã thay đổi hoặc bị trùng. Vui lòng tải lại và thử lại.',
  422: 'Thao tác không hợp lệ với trạng thái hiện tại.',
  429: 'Bạn thao tác quá nhanh. Vui lòng đợi một lát rồi thử lại.',
}

export function hasErrorCode(error: unknown, code: ApiErrorCode): error is ApiError {
  return isApiError(error) && error.code === code
}

/**
 * Vietnamese message for an error. Order: message for the business `code` (most specific) →
 * caller override for the status → message for the status → generic.
 */
export function getErrorMessage(error: unknown, overrides: Partial<Record<number, string>> = {}) {
  if (!isApiError(error)) return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
  const byCode = error.code ? MESSAGES_BY_CODE[error.code] : undefined
  return (
    byCode ??
    overrides[error.status] ??
    MESSAGES_BY_STATUS[error.status] ??
    'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
  )
}
