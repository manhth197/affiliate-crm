import { parsePartnerWebhooks } from './partners';

const valid = {
  id: 'an-phat',
  name: 'Tài chính An Phát',
  secret: 'an-phat-secret-123456',
};

describe('parsePartnerWebhooks', () => {
  it('parses a valid list', () => {
    expect(parsePartnerWebhooks(JSON.stringify([valid]))).toEqual([valid]);
    expect(parsePartnerWebhooks('[]')).toEqual([]);
  });

  it.each([
    ['not json', 'must be valid JSON'],
    ['{}', 'must be a JSON array'],
    [JSON.stringify([{ ...valid, id: 'An Phat' }]), '[0].id'],
    [JSON.stringify([{ ...valid, name: ' ' }]), '[0].name'],
    [JSON.stringify([{ ...valid, secret: 'short' }]), '[0].secret'],
    [JSON.stringify([valid, valid]), 'unique'],
  ])('rejects %s', (json, message) => {
    expect(() => parsePartnerWebhooks(json)).toThrow(message);
  });
});
