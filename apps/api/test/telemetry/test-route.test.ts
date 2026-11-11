// Criterion 10 (route part): the test-only failing route exists only when NODE_ENV=test, is absent
// from the OpenAPI document, and the route matrix lists it as test-only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { envelopeFor } from '@shifa/contracts';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.ts';
import { TEST_FAILURE_ROUTE } from '../../src/platform/test-support.ts';
import { EXPECTED_MATRIX, TEST_ONLY_ROUTES } from '../architecture/route-matrix.expected.ts';
import { buildTestApp, offlineDb } from '../support.ts';

const URL_OK = 'postgres://shifa_app:synthetic-pw-4417@db.internal:5432/shifa';
const OPENAPI = join(import.meta.dirname, '../../../../packages/contracts/generated/openapi.json');

describe('test-only failing route', () => {
  it('is GET /_test/fail', () => {
    expect(TEST_FAILURE_ROUTE).toBe('GET /_test/fail');
  });

  it.each([
    ['test', true],
    ['production', false],
    ['development', false],
    [undefined, false],
  ])('NODE_ENV=%s → test routes %s', (nodeEnv, expected) => {
    const env = { DATABASE_URL: URL_OK, ...(nodeEnv === undefined ? {} : { NODE_ENV: nodeEnv }) };
    expect(loadConfig(env).testRoutes).toBe(expected);
  });

  it('with test routes: registered, answers the 500 envelope', async () => {
    const { app, routes } = await buildTestApp({ db: offlineDb(), testRoutes: true });
    try {
      expect(routes).toContain(TEST_FAILURE_ROUTE);
      const res = await app.inject({ method: 'GET', url: '/_test/fail' });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual(envelopeFor(500));
    } finally {
      await app.close();
    }
  });

  it('without test routes (the default, as in production): absent, 404', async () => {
    const { app, routes } = await buildTestApp({ db: offlineDb() });
    try {
      expect(routes).not.toContain(TEST_FAILURE_ROUTE);
      const res = await app.inject({ method: 'GET', url: '/_test/fail' });
      expect(res.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it('is absent from the committed OpenAPI document', () => {
    const document = readFileSync(OPENAPI, 'utf8');
    expect(document.includes('/_test')).toBe(false);
    expect(document.includes('testFailure')).toBe(false);
  });

  it('is marked test-only in the route matrix', () => {
    expect(TEST_ONLY_ROUTES.has(TEST_FAILURE_ROUTE)).toBe(true);
    expect(Object.values(EXPECTED_MATRIX[TEST_FAILURE_ROUTE] ?? {})).toEqual(
      Array.from({ length: 7 }, () => 500),
    );
    for (const route of TEST_ONLY_ROUTES) expect(EXPECTED_MATRIX).toHaveProperty([route]);
  });
});
