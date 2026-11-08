import { Body, Controller, Post } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { Public } from '../src/access/index.ts';
import { createLogger } from '../src/platform/logging.ts';
import { buildTestApp, captureLogs, offlineDb, type TestApp } from './support.ts';

const TOKEN = 'synthetic-token-8812';
const COOKIE = 'synthetic-cookie-3390';
const BODY_VALUE = 'synthetic-body-7731';
const QUERY_VALUE = 'synthetic-query-2204';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

@Controller('test-logging')
class EchoController {
  @Public()
  @Post()
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
  current = await buildTestApp({ db: offlineDb(), controllers: [EchoController] });
  return current;
}

describe('request logging', () => {
  it('logs each request with method, path and status', async () => {
    const { app: nest, logs } = await app();
    await nest.inject({ method: 'GET', url: '/health/live' });
    expect(logs.text()).toContain('/health/live');
    expect(logs.text()).toContain('"statusCode":200');
  });

  it('never logs authorization or cookie headers', async () => {
    const { app: nest, logs } = await app();
    await nest.inject({
      method: 'GET',
      url: '/health/live',
      headers: { authorization: `Bearer ${TOKEN}`, cookie: `sid=${COOKIE}` },
    });
    expect(logs.text()).not.toContain(TOKEN);
    expect(logs.text()).not.toContain(COOKIE);
  });

  it('never logs the request body or the query string', async () => {
    const { app: nest, logs } = await app();
    await nest.inject({
      method: 'POST',
      url: `/test-logging?phone=${QUERY_VALUE}`,
      payload: { name: BODY_VALUE },
    });
    expect(logs.text()).not.toContain(BODY_VALUE);
    expect(logs.text()).not.toContain(QUERY_VALUE);
  });

  it('redacts secrets when code logs headers or a body directly', () => {
    const logs = captureLogs();
    const logger = createLogger({ level: 'info', destination: logs.stream });
    logger.info({
      headers: { authorization: `Bearer ${TOKEN}`, cookie: COOKIE, 'set-cookie': COOKIE },
      req: { headers: { authorization: TOKEN, cookie: COOKIE }, body: { name: BODY_VALUE } },
      res: { headers: { 'set-cookie': COOKIE } },
      body: { name: BODY_VALUE },
    });
    expect(logs.text()).not.toContain(TOKEN);
    expect(logs.text()).not.toContain(COOKIE);
    expect(logs.text()).not.toContain(BODY_VALUE);
  });
});

describe('request id', () => {
  it('keeps a well-formed x-request-id and returns it', async () => {
    const { app: nest, logs } = await app();
    const id = 'req-ABC_123-def456';
    const res = await nest.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': id },
    });
    expect(res.headers['x-request-id']).toBe(id);
    expect(logs.records().some((r) => r['reqId'] === id)).toBe(true);
  });

  it('replaces a forged x-request-id (newline) with a generated one', async () => {
    const { app: nest, logs } = await app();
    const forged = 'abc\n{"level":60,"msg":"forged"}';
    const res = await nest.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': forged },
    });
    expect(res.headers['x-request-id']).toMatch(UUID);
    expect(logs.text()).not.toContain('forged');
  });

  it('generates an id when none is sent, and never accepts an overlong one', async () => {
    const { app: nest } = await app();
    const none = await nest.inject({ method: 'GET', url: '/health/live' });
    expect(none.headers['x-request-id']).toMatch(UUID);
    const long = await nest.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': 'a'.repeat(200) },
    });
    expect(long.headers['x-request-id']).toMatch(UUID);
  });
});
