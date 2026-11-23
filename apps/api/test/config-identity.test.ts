// A-01-02 configuration: the identity keys (BETTER_AUTH_SECRET, AUTH_HMAC_KEY, DATABASE_URL_AUTH,
// DATABASE_URL_PLATFORM) are required to run the API, validated, and never quoted in errors.
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, loadIdentityConfig } from '../src/config/env.ts';

const SECRET = 'synthetic-secret-0123456789abcdefABCDEF';
const HMAC = 'synthetic-hmac-key-0123456789abcdefABCD';
const AUTH_URL = 'postgres://shifa_auth:synthetic-pw-1@db.internal:5432/shifa';
const PLATFORM_URL = 'postgres://shifa_platform:synthetic-pw-2@db.internal:5432/shifa';

const VALID = {
  BETTER_AUTH_SECRET: SECRET,
  AUTH_HMAC_KEY: HMAC,
  DATABASE_URL_AUTH: AUTH_URL,
  DATABASE_URL_PLATFORM: PLATFORM_URL,
};

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError);
    return (err as Error).message;
  }
  throw new Error('expected a ConfigError');
}

describe('identity configuration', () => {
  it('reads the four keys', () => {
    expect(loadIdentityConfig(VALID)).toEqual({
      betterAuthSecret: SECRET,
      hmacKey: HMAC,
      databaseUrlAuth: AUTH_URL,
      databaseUrlPlatform: PLATFORM_URL,
    });
  });

  it('names every missing key', () => {
    expect(messageOf(() => loadIdentityConfig({}))).toBe(
      'missing or invalid configuration: AUTH_HMAC_KEY, BETTER_AUTH_SECRET, DATABASE_URL_AUTH, DATABASE_URL_PLATFORM',
    );
  });

  it.each([
    ['a short secret', { BETTER_AUTH_SECRET: 'too-short' }, 'BETTER_AUTH_SECRET'],
    [
      'a secret with spaces',
      { AUTH_HMAC_KEY: 'has spaces in it 0123456789abcdef0123' },
      'AUTH_HMAC_KEY',
    ],
    ['the same value for both secrets', { AUTH_HMAC_KEY: SECRET }, 'AUTH_HMAC_KEY'],
    ['a non-postgres URL', { DATABASE_URL_AUTH: 'http://db.internal/shifa' }, 'DATABASE_URL_AUTH'],
  ])('refuses %s, naming the key and never the value', (_label, change, key) => {
    const env = { ...VALID, ...change };
    const message = messageOf(() => loadIdentityConfig(env));
    expect(message).toContain(key);
    for (const value of Object.values(change)) expect(message).not.toContain(value);
    expect(message).not.toContain(SECRET);
  });

  it('a misspelt identity key is a near miss for loadConfig()', () => {
    const base = { DATABASE_URL: 'postgres://shifa_app:pw@db.internal:5432/shifa' };
    expect(messageOf(() => loadConfig({ ...base, BETTER_AUTH_SECERT: SECRET }))).toContain(
      'BETTER_AUTH_SECERT',
    );
    expect(() => loadConfig({ ...base, ...VALID })).not.toThrow();
  });
});
