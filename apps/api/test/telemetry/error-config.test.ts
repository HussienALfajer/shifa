// Criterion 1 (Sentry part): error reporting is configured by env.ts and the Sentry SDK is not
// initialised unless SENTRY_DSN is set. The SDK never registers OpenTelemetry globals of its own:
// 0.2-09b1's tracer provider stays the only one.
import { Controller, Get } from '@nestjs/common';
import { getClient, getIsolationScope, isInitialized } from '@sentry/core';
import { afterEach, describe, expect, it } from 'vitest';
import { Public } from '../../src/access/index.ts';
import { ConfigError, loadConfig } from '../../src/config/env.ts';
import { Contract } from '../../src/platform/contract/index.ts';
import { bootstrapErrorReporting } from '../../src/telemetry/bootstrap.ts';
import { stopErrorReporting } from '../../src/telemetry/errors.ts';
import { buildTestApp, offlineDb, testContract } from '../support.ts';

const URL_OK = 'postgres://shifa_app:synthetic-pw-4417@db.internal:5432/shifa';
const DSN = 'http://public@127.0.0.1:8000/1';

/** Where @opentelemetry/api keeps its global providers. */
const OTEL_GLOBAL = Symbol.for('opentelemetry.js.api.1');

function errorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError);
    return err as ConfigError;
  }
  throw new Error('expected loadConfig to throw');
}

const failing = testContract('GET', '/test-error-config/fail');

@Controller('test-error-config')
class FailingController {
  @Public()
  @Contract(failing)
  @Get('fail')
  fail(): never {
    throw new Error('synthetic failure');
  }
}

afterEach(async () => {
  await stopErrorReporting();
});

describe('error reporting configuration', () => {
  it('is off by default, with no release override', () => {
    expect(loadConfig({ DATABASE_URL: URL_OK }).errors).toEqual({
      dsn: undefined,
      release: undefined,
    });
  });

  it('reads an http(s) DSN with a public key and a release', () => {
    const config = loadConfig({
      DATABASE_URL: URL_OK,
      SENTRY_DSN: DSN,
      SENTRY_RELEASE: 'shifa-api@0.1.0+abc123',
    });
    expect(config.errors).toEqual({ dsn: DSN, release: 'shifa-api@0.1.0+abc123' });
  });

  it.each([
    ['not a URL', 'glitchtip:8000'],
    ['another protocol', 'ftp://public@127.0.0.1:8000/1'],
    ['without a public key', 'http://127.0.0.1:8000/1'],
    ['without a project id', 'http://public@127.0.0.1:8000/'],
  ])('rejects a DSN that is %s, naming the key only', (_what, value) => {
    const err = errorOf(() => loadConfig({ DATABASE_URL: URL_OK, SENTRY_DSN: value }));
    expect(err.message).toContain('SENTRY_DSN');
    expect(err.message).not.toContain(value);
  });

  it.each(['has space', '', 'x'.repeat(201)])('rejects the release %j', (value) => {
    const err = errorOf(() => loadConfig({ DATABASE_URL: URL_OK, SENTRY_RELEASE: value }));
    expect(err.message).toContain('SENTRY_RELEASE');
  });

  it('rejects a near-miss of the DSN key', () => {
    const err = errorOf(() => loadConfig({ DATABASE_URL: URL_OK, SENTRY_DNS: DSN }));
    expect(err.message).toContain('SENTRY_DNS');
  });
});

describe('bootstrapErrorReporting', () => {
  it('without a DSN: the SDK is not initialised and a 500 sends nothing', async () => {
    expect(bootstrapErrorReporting({ DATABASE_URL: URL_OK }, '1.2.3')).toBe(false);
    expect(isInitialized()).toBe(false);
    const { app } = await buildTestApp({ db: offlineDb(), controllers: [FailingController] });
    try {
      const res = await app.inject({ method: 'GET', url: '/test-error-config/fail' });
      expect(res.statusCode).toBe(500);
    } finally {
      await app.close();
    }
    expect(getClient()).toBeUndefined();
    // captureException on a scope records an event id even with no client to send it.
    expect(getIsolationScope().lastEventId()).toBeUndefined();
  });

  it('does nothing when the configuration is invalid (main.ts reports it)', () => {
    expect(bootstrapErrorReporting({ SENTRY_DSN: DSN }, '1.2.3')).toBe(false);
    expect(isInitialized()).toBe(false);
  });

  it('with a DSN: initialised with the service version as release, no tracing, no integrations', () => {
    expect(bootstrapErrorReporting({ DATABASE_URL: URL_OK, SENTRY_DSN: DSN }, '1.2.3')).toBe(true);
    expect(isInitialized()).toBe(true);
    const options = getClient()?.getOptions();
    expect(options?.release).toBe('1.2.3');
    expect(options?.environment).toBe('development');
    expect(options?.tracesSampleRate).toBeUndefined();
    expect(options?.tracesSampler).toBeUndefined();
    expect(options?.integrations.map((i) => i.name)).toEqual([]);
    expect(options?.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
    expect(options?.beforeSend).toBeTypeOf('function');
    expect(options?.beforeBreadcrumb).toBeTypeOf('function');
  });

  it('SENTRY_RELEASE overrides the service version', () => {
    bootstrapErrorReporting(
      { DATABASE_URL: URL_OK, SENTRY_DSN: DSN, SENTRY_RELEASE: 'shifa-api@9.9.9' },
      '1.2.3',
    );
    expect(getClient()?.getOptions().release).toBe('shifa-api@9.9.9');
  });

  it('registers no OpenTelemetry provider of its own', () => {
    bootstrapErrorReporting({ DATABASE_URL: URL_OK, SENTRY_DSN: DSN }, '1.2.3');
    expect((globalThis as Record<symbol, unknown>)[OTEL_GLOBAL]).toBeUndefined();
  });

  it('stopErrorReporting unbinds the client', async () => {
    bootstrapErrorReporting({ DATABASE_URL: URL_OK, SENTRY_DSN: DSN }, '1.2.3');
    await stopErrorReporting();
    expect(isInitialized()).toBe(false);
  });
});
