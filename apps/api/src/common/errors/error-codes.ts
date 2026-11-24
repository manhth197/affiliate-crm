import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * Machine-readable codes for business errors (403 disabled account, 409, 422),
 * so the web app can show its own Vietnamese message instead of parsing ours.
 */
export const ErrorCode = {
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  DUPLICATE_LEAD: 'DUPLICATE_LEAD',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  CONCURRENT_UPDATE: 'CONCURRENT_UPDATE',
  PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  AMOUNT_NOT_ALLOWED: 'AMOUNT_NOT_ALLOWED',
  ASSIGNEE_NOT_STAFF: 'ASSIGNEE_NOT_STAFF',
  // Added in M3 (proposed for the contract):
  CANNOT_DISABLE_SELF: 'CANNOT_DISABLE_SELF',
  DISBURSED_AMOUNT_REQUIRED: 'DISBURSED_AMOUNT_REQUIRED',
  INVALID_COMMISSION_STATUS: 'INVALID_COMMISSION_STATUS',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Body of a business exception: the filter copies `code` into the response. */
function body(code: ErrorCode, message: string) {
  return { code, message };
}

export const conflict = (code: ErrorCode, message: string) =>
  new ConflictException(body(code, message));

export const unprocessable = (code: ErrorCode, message: string) =>
  new UnprocessableEntityException(body(code, message));

export const forbidden = (code: ErrorCode, message: string) =>
  new ForbiddenException(body(code, message));
