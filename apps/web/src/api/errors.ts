import type { ApiErrorBody } from './types'

/** Error thrown by the API client for any non-2xx response (status 0 = network failure). */
export class ApiError extends Error {
  readonly status: number
  readonly details: { field: string; message: string }[]

  constructor(status: number, body?: Partial<ApiErrorBody>) {
    super(body?.message ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.details = body?.details ?? []
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
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

/**
 * Vietnamese message for showing an error to the user. The API returns English messages,
 * so we map by status code; callers can pass overrides for context-specific wording.
 */
export function getErrorMessage(error: unknown, overrides: Partial<Record<number, string>> = {}) {
  if (isApiError(error)) {
    return (
      overrides[error.status] ??
      MESSAGES_BY_STATUS[error.status] ??
      'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
    )
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}
