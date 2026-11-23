// A-01a "Money, abuse and privacy": synthetic phones, passwords and session tokens go through
// sign-in, a wrong password, an unknown phone, a phone lock, an IP block, a session read and
// sign-out, and then appear nowhere: not in local logs, exported spans or log records, error
// events, or audit rows.
import { JsonLogsSerializer, JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { syntheticPhones, testAuthDb, testDb } from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  flushErrors,
  startErrorReporting,
  stopErrorReporting,
} from '../../src/telemetry/errors.ts';
import { auditRows, PASSWORD, resetWithTenants, seedPerson } from '../identity/support.ts';
import { buildTestApp, type TestApp } from '../support.ts';
import { type ErrorSink, errorSink, TEST_DSN } from './error-sink.ts';
import { listen, startTestTelemetry, type TestTelemetry } from './support.ts';

const [KNOWN, UNKNOWN, LOCKED] = syntheticPhones(2026_11_19, 3).map((p) => p);
const WRONG_PASSWORD = 'synthetic-wrong-password-7c1e';
const IP = '127.0.0.1';

let test: TestTelemetry;
let errors: ErrorSink;
let current: TestApp;
let token = '';

/** Every spelling of a phone a client might type or a careless log might hold. */
function spellings(e164: string): string[] {
  const national = e164.replace(/^\+963/, '0').replace(/^\+90/, '0');
  const arabic = national.replace(/\d/g, (d) => String.fromCodePoint(0x0660 + Number(d)));
  return [e164, e164.slice(1), national, national.slice(1), arabic];
}

beforeAll(async () => {
  test = startTestTelemetry();
  errors = errorSink();
  startErrorReporting({
    dsn: TEST_DSN,
    release: 'shifa-api@0.0.0-test',
    environment: 'test',
    transport: errors.transport,
  });
  await resetWithTenants();
  await seedPerson(KNOWN ?? '');
  await seedPerson(LOCKED ?? '');
  current = await buildTestApp({ db: testDb(), authDb: testAuthDb(), forwardLogs: true });
  const base = await listen(current.app);
  const post = (path: string, body: unknown, cookie?: string) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  // The phone as typed in local Arabic-Indic digits.
  const typed = spellings(KNOWN ?? '')[4] ?? '';
  const signedIn = await post('/auth/sign-in', { phone: typed, password: PASSWORD });
  expect(signedIn.status).toBe(200);
  const cookie = (signedIn.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  token = decodeURIComponent(cookie.split('=')[1] ?? '');
  await post('/auth/sign-in', { phone: KNOWN, password: WRONG_PASSWORD });
  await post('/auth/sign-in', { phone: UNKNOWN, password: WRONG_PASSWORD });
  for (let i = 0; i < 6; i += 1) {
    await post('/auth/sign-in', { phone: LOCKED, password: WRONG_PASSWORD });
  }
  // The IP block: 30 failures from this address in all.
  for (let i = 0; i < 25; i += 1) {
    await post('/auth/sign-in', { phone: UNKNOWN, password: `${WRONG_PASSWORD}-${String(i)}` });
  }
  const blocked = await post('/auth/sign-in', { phone: KNOWN, password: PASSWORD });
  expect(blocked.status).toBe(429);
  await fetch(`${base}/auth/session`, { headers: { cookie } });
  await post('/auth/sign-out', {}, cookie);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await flushErrors(2000);
});

afterAll(async () => {
  await current.app.close();
  await stopErrorReporting();
  await test.telemetry.shutdown();
});

describe('identity leak test', () => {
  it('produced telemetry to search', async () => {
    expect(token.length).toBeGreaterThan(20);
    expect((await test.spans()).length).toBeGreaterThan(0);
    expect(current.logs.records().length).toBeGreaterThan(0);
    expect((await auditRows()).length).toBeGreaterThan(5);
  });

  it('no phone, password, token or IP appears anywhere', async () => {
    const spans = new TextDecoder().decode(
      JsonTraceSerializer.serializeRequest(await test.spans()) ?? new Uint8Array(),
    );
    const logs = new TextDecoder().decode(
      JsonLogsSerializer.serializeRequest(test.logExporter.getFinishedLogRecords()) ??
        new Uint8Array(),
    );
    const stores = {
      'local logs': current.logs.text(),
      'exported spans': spans,
      'exported logs': logs,
      'error events': errors.text(),
      'audit rows': JSON.stringify(await auditRows()),
    };
    const secrets = [
      ...[KNOWN, UNKNOWN, LOCKED].flatMap((p) => spellings(p ?? '')),
      PASSWORD,
      WRONG_PASSWORD,
      token,
      token.split('.')[0] ?? '',
    ];
    for (const [store, text] of Object.entries(stores)) {
      for (const secret of secrets) {
        expect(text.includes(secret), `${store} holds a secret`).toBe(false);
      }
    }
    expect(stores['audit rows']).not.toContain(IP);
  });
});
