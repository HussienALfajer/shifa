// The global filter answers with a minimal envelope and logs database errors as SQLSTATE,
// constraint, table and column only: PostgreSQL messages and `detail` can echo patient data.
import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import type { ShifaDb } from '@shifa/db';
import { testDb } from '@shifa/db/testing';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { Public } from '../src/access/index.ts';
import { SHIFA_DB } from '../src/platform/database.module.ts';
import { buildTestApp, type TestApp } from './support.ts';

// Recognisable synthetic values standing in for patient data.
const MARKER = 'synthetic-value-5521';

@Controller('test-errors')
class FailingController {
  constructor(@Inject(SHIFA_DB) private readonly db: ShifaDb) {}

  /** Shaped like pg's DatabaseError for a unique violation whose detail echoes the value. */
  @Public()
  @Get('unique')
  unique(): never {
    throw Object.assign(
      new Error(`duplicate key value violates unique constraint "patients_phone_key"`),
      {
        name: 'error',
        severity: 'ERROR',
        code: '23505',
        detail: `Key (phone)=(${MARKER}) already exists.`,
        schema: 'public',
        table: 'patients',
        constraint: 'patients_phone_key',
      },
    );
  }

  /** A real 22P02 from PostgreSQL: its message echoes the value that failed to cast. */
  @Public()
  @Get('cast')
  async cast(): Promise<unknown> {
    return this.db.withPlatformAdmin('errors test', (tx) =>
      tx.execute(sql`select ${MARKER}::int as n`),
    );
  }

  @Public()
  @Post('echo')
  echo(@Body() body: unknown): unknown {
    return body;
  }
}

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

async function app(): Promise<TestApp> {
  current = await buildTestApp({ db: testDb(), controllers: [FailingController] });
  return current;
}

const INTERNAL = { error: { code: 'internal_error', message: 'Internal server error' } };

describe('database errors', () => {
  it('answer 500 internal_error and log only sqlstate, constraint and table', async () => {
    const { app: nest, logs } = await app();
    const res = await nest.inject({ method: 'GET', url: '/test-errors/unique' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual(INTERNAL);
    const failure = logs.records().find((r) => r['err'] !== undefined);
    expect(failure?.['err']).toMatchObject({
      sqlstate: '23505',
      constraint: 'patients_phone_key',
      table: 'patients',
    });
    expect(logs.text()).not.toContain(MARKER);
    expect(logs.text()).not.toContain('duplicate key value');
    expect(res.body).not.toContain(MARKER);
  });

  it('never let a 22P02 invalid-input message reach the log', async () => {
    const { app: nest, logs } = await app();
    const res = await nest.inject({ method: 'GET', url: '/test-errors/cast' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual(INTERNAL);
    expect(logs.text()).toContain('"sqlstate":"22P02"');
    expect(logs.text()).not.toContain(MARKER);
    expect(logs.text()).not.toContain('invalid input syntax');
    expect(res.body).not.toContain(MARKER);
  });
});

describe('HTTP errors', () => {
  it('an unknown route answers the 404 envelope without echoing the path', async () => {
    const { app: nest } = await app();
    const res = await nest.inject({ method: 'GET', url: `/no-such-route/${MARKER}` });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } });
    expect(res.body).not.toContain(MARKER);
  });

  it('a body over 1 MB answers 413 and is never logged', async () => {
    const { app: nest, logs } = await app();
    const res = await nest.inject({
      method: 'POST',
      url: '/test-errors/echo',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ note: MARKER, pad: 'x'.repeat(1_100_000) }),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({
      error: { code: 'payload_too_large', message: 'Payload too large' },
    });
    expect(logs.text()).not.toContain(MARKER);
  });

  it('malformed JSON answers 400 without echoing the input', async () => {
    const { app: nest, logs } = await app();
    const res = await nest.inject({
      method: 'POST',
      url: '/test-errors/echo',
      headers: { 'content-type': 'application/json' },
      payload: `{"note": "${MARKER}"`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: { code: 'bad_request', message: 'Bad request' } });
    expect(res.body).not.toContain(MARKER);
    expect(logs.text()).not.toContain(MARKER);
  });
});
