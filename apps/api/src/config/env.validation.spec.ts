import { NodeEnv, validateEnv } from './env.validation';

const required = {
  DATABASE_URL: 'postgresql://crm:crm@localhost:5433/affiliate_crm',
  REDIS_URL: 'redis://localhost:6380',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults and converts numeric strings', () => {
    const env = validateEnv({ ...required, PORT: '4000' });
    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.JWT_ACCESS_TTL_SECONDS).toBe(900);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
    expect(env.CORS_ORIGINS).toBe('http://localhost:5173');
  });

  it('fails fast with a readable list of problems', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'mysql://nope',
        JWT_ACCESS_SECRET: 'short',
        PORT: 'abc',
      }),
    ).toThrow(/DATABASE_URL[\s\S]*REDIS_URL[\s\S]*JWT_ACCESS_SECRET|PORT/);
  });

  it('rejects an access token TTL under one minute', () => {
    expect(() =>
      validateEnv({ ...required, JWT_ACCESS_TTL_SECONDS: '10' }),
    ).toThrow(/JWT_ACCESS_TTL_SECONDS/);
  });

  it.each([
    [undefined, false],
    ['false', false],
    ['true', true],
    ['1', false],
  ])(
    'parses COOKIE_SECURE=%p as %p (not Boolean("false") === true)',
    (raw, expected) => {
      const env = validateEnv(
        raw === undefined ? required : { ...required, COOKIE_SECURE: raw },
      );
      expect(env.COOKIE_SECURE).toBe(expected);
    },
  );
});
