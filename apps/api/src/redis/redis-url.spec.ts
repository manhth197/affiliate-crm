import { bullConnectionFromUrl } from './redis-url';

describe('bullConnectionFromUrl', () => {
  it('parses host, port and database', () => {
    expect(bullConnectionFromUrl('redis://localhost:6380/1')).toEqual({
      host: 'localhost',
      port: 6380,
      db: 1,
      maxRetriesPerRequest: null,
    });
  });

  it('defaults the port and omits empty parts', () => {
    expect(bullConnectionFromUrl('redis://redis')).toEqual({
      host: 'redis',
      port: 6379,
      maxRetriesPerRequest: null,
    });
  });

  it('decodes credentials and enables TLS for rediss://', () => {
    expect(
      bullConnectionFromUrl('rediss://default:p%40ss@cache.example.com:6380/2'),
    ).toEqual({
      host: 'cache.example.com',
      port: 6380,
      username: 'default',
      password: 'p@ss',
      db: 2,
      tls: {},
      maxRetriesPerRequest: null,
    });
  });
});
