// The other half of the unknown-key rule: a real host's unrelated variables must not stop the
// API, while near-misses of our own keys still do.
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config/env.ts';

const URL_OK = 'postgres://shifa_app:synthetic-pw@db.internal:5432/shifa';

describe('loadConfig on a real host environment', () => {
  it('ignores unrelated variables, including other API_* and APP_* keys', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: URL_OK,
        API_TIMEOUT_MS: '30000',
        API_KEY_EXAMPLE: 'x',
        APP_PORT: '8080',
        APP_HOST: 'example',
        LOGNAME: 'dev',
        PATH: '/usr/bin',
      }),
    ).not.toThrow();
  });

  it.each(['API_PROT', 'API_PORTS', 'DATABSE_URL', 'LOG_LEVLE'])(
    'refuses the near-miss %s',
    (key) => {
      expect(() => loadConfig({ DATABASE_URL: URL_OK, [key]: '1' })).toThrow(ConfigError);
    },
  );
});
