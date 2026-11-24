import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsVnPhone, normalizeVnPhone } from './vn-phone';

class PhoneHolder {
  @IsVnPhone()
  phone!: string;
}

function check(phone: unknown): { value: unknown; valid: boolean } {
  const instance = plainToInstance(PhoneHolder, { phone });
  return {
    value: instance.phone,
    valid: validateSync(instance).length === 0,
  };
}

describe('VN phone validation', () => {
  it.each([
    ['0912345678', '0912345678'],
    ['+84912345678', '0912345678'],
    ['84912345678', '0912345678'],
    ['+84 912 345 678', '0912345678'],
    ['0912.345.678', '0912345678'],
    ['(091) 234-5678', '0912345678'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeVnPhone(input)).toBe(expected);
  });

  it.each([
    '0312345678',
    '0512345678',
    '0712345678',
    '0812345678',
    '0987654321',
  ])('accepts mobile prefix of %s', (phone) => {
    expect(check(phone)).toEqual({ value: phone, valid: true });
  });

  it.each([
    ['too short', '091234567'],
    ['too long', '09123456789'],
    ['landline / invalid prefix 02', '0241234567'],
    ['invalid prefix 01', '0112345678'],
    ['letters', '09123abc78'],
    ['empty', ''],
  ])('rejects %s', (_label, phone) => {
    expect(check(phone).valid).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(check(912345678).valid).toBe(false);
  });
});
