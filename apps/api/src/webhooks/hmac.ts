import { createHmac, timingSafeEqual } from 'node:crypto';

/** Requests older (or further in the future) than this are rejected: limits replay. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/**
 * Signature = hex HMAC-SHA256 of `${timestamp}.${rawBody}` with the partner
 * secret. Signing the timestamp too means an attacker cannot replay an old
 * body with a fresh timestamp.
 */
export function signWebhook(
  secret: string,
  timestamp: string,
  rawBody: Buffer | string,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
}

/** Constant-time comparison, so response timing does not leak how many characters matched. */
export function isValidSignature(
  secret: string,
  timestamp: string,
  rawBody: Buffer | string,
  signature: string,
): boolean {
  if (!/^[0-9a-f]{64}$/i.test(signature)) {
    return false;
  }
  const expected = Buffer.from(signWebhook(secret, timestamp, rawBody), 'hex');
  const received = Buffer.from(signature, 'hex');
  return timingSafeEqual(expected, received);
}

/** `timestamp` is unix seconds; must be within ±tolerance of now. */
export function isFreshTimestamp(
  timestamp: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = WEBHOOK_TOLERANCE_SECONDS,
): boolean {
  if (!/^\d{1,12}$/.test(timestamp)) {
    return false;
  }
  return Math.abs(nowSeconds - Number(timestamp)) <= toleranceSeconds;
}
