import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config/env.ts';

const SECRET = 'synthetic-pw-4417';
const URL_OK = `postgres://shifa_app:${SECRET}@db.internal:5432/shifa`;

function errorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError);
    return err as ConfigError;
  }
  throw new Error('expected loadConfig to throw');
}

describe('loadConfig', () => {
  it('reads a valid environment and applies defaults', () => {
    const config = loadConfig({ DATABASE_URL: URL_OK, PATH: '/usr/bin' });
    expect(config).toEqual({
      port: 3000,
      host: '127.0.0.1',
      databaseUrl: URL_OK,
      logLevel: 'info',
      telemetry: { endpoint: undefined, samplerRatio: 1, environment: 'development' },
      errors: { dsn: undefined, release: undefined },
      testRoutes: false,
    });
  });

  it('reads explicit values', () => {
    const config = loadConfig({
      DATABASE_URL: URL_OK,
      API_PORT: '8080',
      API_HOST: '0.0.0.0',
      LOG_LEVEL: 'warn',
    });
    expect(config).toMatchObject({ port: 8080, host: '0.0.0.0', logLevel: 'warn' });
  });

  it('names a missing DATABASE_URL', () => {
    const err = errorOf(() => loadConfig({}));
    expect(err.message).toContain('DATABASE_URL');
  });

  it('never echoes the password of an invalid DATABASE_URL', () => {
    const err = errorOf(() =>
      loadConfig({ DATABASE_URL: `mysql://shifa_app:${SECRET}@db.internal/shifa` }),
    );
    expect(err.message).toContain('DATABASE_URL');
    expect(err.message).not.toContain(SECRET);
    expect(JSON.stringify(err)).not.toContain(SECRET);
    expect(String(err.stack)).not.toContain(SECRET);
  });

  it('names an invalid value without echoing it', () => {
    const err = errorOf(() => loadConfig({ DATABASE_URL: URL_OK, API_PORT: SECRET }));
    expect(err.message).toContain('API_PORT');
    expect(err.message).not.toContain(SECRET);
    expect(err.message).not.toContain(URL_OK);
  });

  it('rejects an unknown log level', () => {
    const err = errorOf(() => loadConfig({ DATABASE_URL: URL_OK, LOG_LEVEL: 'verbose' }));
    expect(err.message).toContain('LOG_LEVEL');
  });

  it('rejects an unknown API_* key (a typo would otherwise be ignored)', () => {
    const err = errorOf(() => loadConfig({ DATABASE_URL: URL_OK, API_PROT: '8080' }));
    expect(err.message).toContain('API_PROT');
  });
});
