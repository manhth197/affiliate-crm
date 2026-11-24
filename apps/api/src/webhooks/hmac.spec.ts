import { createHmac } from 'node:crypto';
import { isFreshTimestamp, isValidSignature, signWebhook } from './hmac';

const SECRET = 'partner-secret-0123456789';
const BODY = '{"eventId":"evt-1","leadCode":"LD-000001","status":"APPROVED"}';
const TS = '1795490147';

describe('webhook HMAC', () => {
  it('signs `${timestamp}.${rawBody}` with HMAC-SHA256 (hex)', () => {
    const expected = createHmac('sha256', SECRET)
      .update(`${TS}.${BODY}`)
      .digest('hex');
    expect(signWebhook(SECRET, TS, BODY)).toBe(expected);
    expect(signWebhook(SECRET, TS, Buffer.from(BODY))).toBe(expected);
  });

  it('accepts a correct signature (any hex case)', () => {
    const signature = signWebhook(SECRET, TS, BODY);
    expect(isValidSignature(SECRET, TS, BODY, signature)).toBe(true);
    expect(isValidSignature(SECRET, TS, BODY, signature.toUpperCase())).toBe(
      true,
    );
  });

  it('rejects a tampered body, timestamp or secret', () => {
    const signature = signWebhook(SECRET, TS, BODY);
    expect(
      isValidSignature(
        SECRET,
        TS,
        BODY.replace('APPROVED', 'DISBURSED'),
        signature,
      ),
    ).toBe(false);
    expect(isValidSignature(SECRET, '1795490148', BODY, signature)).toBe(false);
    expect(
      isValidSignature('other-secret-0123456789', TS, BODY, signature),
    ).toBe(false);
  });

  it('rejects malformed signatures without throwing', () => {
    for (const bad of [
      '',
      'abc',
      'z'.repeat(64),
      'a'.repeat(63),
      'a'.repeat(66),
    ]) {
      expect(isValidSignature(SECRET, TS, BODY, bad)).toBe(false);
    }
  });
});

describe('isFreshTimestamp', () => {
  const now = 1_795_490_147;

  it('accepts timestamps within 5 minutes either way', () => {
    expect(isFreshTimestamp(String(now), now)).toBe(true);
    expect(isFreshTimestamp(String(now - 300), now)).toBe(true);
    expect(isFreshTimestamp(String(now + 300), now)).toBe(true);
  });

  it('rejects older or future-dated timestamps beyond 5 minutes', () => {
    expect(isFreshTimestamp(String(now - 301), now)).toBe(false);
    expect(isFreshTimestamp(String(now + 301), now)).toBe(false);
  });

  it('rejects non-numeric values and milliseconds', () => {
    expect(isFreshTimestamp('abc', now)).toBe(false);
    expect(isFreshTimestamp('', now)).toBe(false);
    expect(isFreshTimestamp(String(now * 1000), now)).toBe(false);
    expect(isFreshTimestamp('-1', now)).toBe(false);
  });
});
