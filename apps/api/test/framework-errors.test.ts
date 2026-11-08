// Security review 0.2-06a: Fastify's own routing errors (bad URL encoding, overlong path
// parameters) bypassed the filter and logged/echoed the full URL with its query string.
import { Controller, Get, Param } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { Public } from '../src/access/index.ts';
import { Contract } from '../src/platform/contract/index.ts';
import { createLogger } from '../src/platform/logging.ts';
import { buildTestApp, captureLogs, offlineDb, type TestApp, testContract } from './support.ts';

const MARKER = 'synthetic-value-9043';

@Controller('test-items')
class ItemsController {
  @Public()
  @Contract(testContract('GET', '/test-items/:id'))
  @Get(':id')
  one(@Param('id') id: string): { length: number } {
    return { length: id.length };
  }
}

let current: TestApp | undefined;

afterEach(async () => {
  await current?.app.close();
  current = undefined;
});

async function app(): Promise<TestApp> {
  current = await buildTestApp({ db: offlineDb(), controllers: [ItemsController] });
  return current;
}

describe('framework errors', () => {
  it('a malformed URL answers the 400 envelope and logs no query string', async () => {
    const { app: nest, logs } = await app();
    const res = await nest.inject({ method: 'GET', url: `/test-items/%zz?phone=${MARKER}` });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: { code: 'bad_request', message: 'Bad request' } });
    expect(res.body).not.toContain(MARKER);
    expect(logs.text()).not.toContain(MARKER);
  });

  it('an overlong path parameter answers an envelope and is not logged', async () => {
    const { app: nest, logs } = await app();
    const res = await nest.inject({
      method: 'GET',
      url: `/test-items/${MARKER}${'x'.repeat(120)}`,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
    expect(Object.keys(res.json<object>())).toEqual(['error']);
    expect(res.body).not.toContain(MARKER);
    expect(logs.text()).not.toContain(MARKER);
  });
});

describe('request logs', () => {
  it('record the route template, not the concrete path parameter', async () => {
    const { app: nest, logs } = await app();
    const res = await nest.inject({ method: 'GET', url: `/test-items/${MARKER}` });
    expect(res.statusCode).toBe(200);
    expect(logs.text()).toContain('/test-items/:id');
    expect(logs.text()).not.toContain(MARKER);
  });
});

describe('logger', () => {
  it('a bare error passed to log.error() keeps identifiers only', () => {
    const logs = captureLogs();
    const logger = createLogger({ level: 'info', destination: logs.stream });
    const err = Object.assign(new Error(`invalid input syntax for type integer: "${MARKER}"`), {
      severity: 'ERROR',
      code: '22P02',
    });
    logger.error(err);
    logger.error(err, 'with a message');
    expect(logs.text()).toContain('"sqlstate":"22P02"');
    expect(logs.text()).not.toContain(MARKER);
  });
});
