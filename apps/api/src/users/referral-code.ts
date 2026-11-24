import { randomInt } from 'node:crypto';

/** No 0/O or 1/I so codes are easy to read aloud and type. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
export const REFERRAL_CODE_PATTERN = /^CTV[A-HJ-NP-Z2-9]{6}$/;

/**
 * "CTV" + 6 random characters, e.g. "CTV7K3Q9Z" (32^6 ≈ 1 billion codes).
 * Uniqueness is enforced by the DB; the caller retries on a collision.
 */
export function generateReferralCode(
  nextInt: (max: number) => number = randomInt,
): string {
  let code = 'CTV';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[nextInt(ALPHABET.length)];
  }
  return code;
}
