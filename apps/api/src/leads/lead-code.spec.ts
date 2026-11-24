import { formatLeadCode, parseLeadCode } from './lead-code';

describe('lead code', () => {
  it('pads the number to 6 digits', () => {
    expect(formatLeadCode(123)).toBe('LD-000123');
    expect(formatLeadCode(1234567)).toBe('LD-1234567');
  });

  it.each([
    ['LD-000123', 123],
    ['ld-123', 123],
    ['LD000123', 123],
    [' LD-42 ', 42],
  ])('parses %p', (code, expected) => {
    expect(parseLeadCode(code)).toBe(expected);
  });

  it.each(['', 'LD-', 'AB-000123', 'LD-12a', '000123', 'Nguyễn'])(
    'rejects %p',
    (code) => {
      expect(parseLeadCode(code)).toBeNull();
    },
  );

  it('round-trips', () => {
    expect(parseLeadCode(formatLeadCode(98765))).toBe(98765);
  });
});
