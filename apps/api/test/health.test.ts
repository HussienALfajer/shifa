import { createDb } from '@shifa/db';
import { harnessUrl, testDb } from '@shifa/db/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, offlineDb, type TestApp } from './support.ts';

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

describe('GET /health/live', () => {
  it('answers 200 without touching the database', async () => {
    const db = offlineDb();
    current = await buildTestApp({ db });
    const res = await current.app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(db.calls).toBe(0);
  });
});

describe('GET /health/ready', () => {
  it('answers 200 when the database answers', async () => {
    current = await buildTestApp({ db: testDb() });
    const res = await current.app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('answers 503 with no error text when the database is gone', async () => {
    const db = createDb(harnessUrl('app'));
    await db.close();
    current = await buildTestApp({ db });
    const res = await current.app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({
      error: { code: 'service_unavailable', message: 'Service unavailable' },
    });
    expect(res.body).not.toMatch(/pool|postgres|shifa_app|localhost|127\.0\.0\.1/i);
  });

  it('carries no host or version headers', async () => {
    current = await buildTestApp({ db: testDb() });
    const res = await current.app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers.server).toBeUndefined();
  });
});
