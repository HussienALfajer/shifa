// Requests are validated against the route's contract before the handler runs. Failures answer
// 400 validation_failed with field paths and issue codes only: no input value reaches the
// response or the log.
import { ErrorEnvelope } from '@shifa/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTestApp, offlineDb, type TestApp } from '../support.ts';
import { ContractProbeController } from './probe.ts';

// Recognisable synthetic values standing in for patient data.
const MARKER = 'synthetic-value-7731';
const ID = '00000000-0000-4000-8000-000000000123';

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

async function app(): Promise<TestApp> {
  current = await buildTestApp({ db: offlineDb(), controllers: [ContractProbeController] });
  return current;
}

async function post(t: TestApp, url: string, body: unknown) {
  return t.app.inject({
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify(body),
  });
}

function failure(details: { path: string; code: string }[]) {
  return { error: { code: 'validation_failed', message: 'Bad request', details } };
}

describe('request validation', () => {
  it('a valid request reaches the handler with parsed, coerced values', async () => {
    const t = await app();
    const res = await post(t, `/__contract/items/${ID}?limit=5`, {
      name: 'n',
      phone: '0999000111',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: ID,
      limit: 5,
      kind: null,
      name: 'n',
      phone: '0999000111',
    });
  });

  it('unknown body keys are stripped before the handler sees them', async () => {
    const t = await app();
    const res = await post(t, `/__contract/items/${ID}?limit=5&kind=second`, {
      name: 'n',
      phone: '0999000111',
      extra: MARKER,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ kind: 'second' });
    expect(res.body).not.toContain(MARKER);
  });

  it('an invalid body answers 400 with paths and codes, never the value', async () => {
    const t = await app();
    const res = await post(t, `/__contract/items/${ID}?limit=5`, { name: MARKER, phone: 12 });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(failure([{ path: 'body.phone', code: 'invalid_type' }]));
    expect(res.body).not.toContain(MARKER);
    expect(t.logs.text()).not.toContain(MARKER);
  });

  it('a too short value is reported without echoing it', async () => {
    const t = await app();
    const res = await post(t, `/__contract/items/${ID}?limit=5`, { name: 'n', phone: '77' });
    expect(res.json()).toEqual(failure([{ path: 'body.phone', code: 'too_small' }]));
    expect(res.body).not.toContain('"77"');
  });

  it('an invalid query answers 400 and the query string is not logged', async () => {
    const t = await app();
    const res = await post(t, `/__contract/items/${ID}?limit=${MARKER}`, {
      name: 'n',
      phone: '0999000111',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(failure([{ path: 'query.limit', code: 'invalid_type' }]));
    expect(t.logs.text()).not.toContain(MARKER);
  });

  it('an out-of-range and an unknown enum query value are both reported', async () => {
    const t = await app();
    const res = await post(t, `/__contract/items/${ID}?limit=500&kind=third`, {
      name: 'n',
      phone: '0999000111',
    });
    expect(res.json()).toEqual(
      failure([
        { path: 'query.limit', code: 'too_big' },
        { path: 'query.kind', code: 'invalid_value' },
      ]),
    );
  });

  it('invalid params, query and body are reported together, in that order', async () => {
    const t = await app();
    const res = await post(t, `/__contract/items/${MARKER}`, { name: '' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(
      failure([
        { path: 'params.id', code: 'invalid_format' },
        { path: 'query.limit', code: 'invalid_type' },
        { path: 'body.name', code: 'too_small' },
        { path: 'body.phone', code: 'invalid_type' },
      ]),
    );
    expect(res.body).not.toContain(MARKER);
    expect(t.logs.text()).not.toContain(MARKER);
  });

  it('a missing body is a validation failure, not a crash', async () => {
    const t = await app();
    const res = await t.app.inject({ method: 'POST', url: `/__contract/items/${ID}?limit=5` });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(failure([{ path: 'body', code: 'invalid_type' }]));
  });

  it('the 400 envelope parses with ErrorEnvelope', async () => {
    const t = await app();
    const res = await post(t, `/__contract/items/${ID}?limit=5`, {});
    expect(ErrorEnvelope.safeParse(res.json()).success).toBe(true);
  });

  it('logs the route template and issue codes only', async () => {
    const t = await app();
    await post(t, `/__contract/items/${ID}?limit=5`, { name: MARKER, phone: 12 });
    const line = t.logs.records().find((r) => r.msg === 'request validation failed');
    expect(line).toMatchObject({
      route: '/__contract/items/:id',
      issues: [{ path: 'body.phone', code: 'invalid_type' }],
    });
    expect(t.logs.text()).not.toContain(ID);
  });

  it('access is checked before validation: anonymous callers get 401, not 400', async () => {
    const t = await app();
    const res = await post(t, '/__contract/protected', { name: MARKER });
    expect(res.statusCode).toBe(401);
    expect(res.body).not.toContain(MARKER);
  });
});
