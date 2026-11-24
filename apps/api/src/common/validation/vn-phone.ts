import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/** Vietnamese mobile numbers after normalisation: 10 digits, prefixes 03/05/07/08/09. */
export const VN_MOBILE_PATTERN = /^0[35789]\d{8}$/;

/**
 * Normalises common input forms to 0XXXXXXXXX:
 * "+84 912 345 678", "84912345678", "0912.345.678" → "0912345678".
 */
export function normalizeVnPhone(raw: string): string {
  const compact = raw.replace(/[\s.\-()]/g, '');
  if (compact.startsWith('+84')) {
    return `0${compact.slice(3)}`;
  }
  if (compact.startsWith('84') && compact.length === 11) {
    return `0${compact.slice(2)}`;
  }
  return compact;
}

/** DTO property decorator: normalise, then validate as a VN mobile number. */
export function IsVnPhone(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeVnPhone(value) : value,
    ),
    Matches(VN_MOBILE_PATTERN, { message: 'must be a valid VN phone number' }),
  );
}
