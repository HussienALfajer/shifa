// A-03 "Money, abuse and privacy" for A-03-02: a chart's names, phones, date of birth and previous
// file number go through a registration (with a replay and a clashing id), refused saves (invalid
// phone, invalid name, previous number taken), a read, an edit (and a stale one), an archive and a
// restore; then appear nowhere: not in local logs, exported spans or log records, error events, or
// audit rows. Paths carry the chart id only.
import { randomUUID } from 'node:crypto';
import { JsonLogsSerializer, JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { auditEvent } from '@shifa/db';
import {
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  flushErrors,
  startErrorReporting,
  stopErrorReporting,
} from '../../src/telemetry/errors.ts';
import { testClock } from '../identity/support.ts';
import {
  CLINIC_WEB_URL,
  createClinicViaApi,
  resetDatabase,
  setUpOwner,
  signedInAdmin,
} from '../platform/support.ts';
import { buildTestApp, type TestApp } from '../support.ts';
import { type ErrorSink, errorSink, TEST_DSN } from './error-sink.ts';
import { listen, startTestTelemetry, type TestTelemetry } from './support.ts';

const [ADMIN, OWNER, CONTACT, SECOND, EDITED] = syntheticPhones(2026_11_30, 5) as [
  string,
  string,
  string,
  string,
  string,
];
const GIVEN = 'نسرين';
const FATHER = 'مصطفى';
const FAMILY = 'القطان';
const MOTHER = 'رقية';
const NEW_FAMILY = 'الدباغ';
const BIRTH = '1987-04-19';
const NEW_BIRTH = '1988-09-03';
const PREVIOUS = 'PX-4471';

let test: TestTelemetry;
let errors: ErrorSink;
let current: TestApp;
const audited: string[] = [];

function spellings(e164: string): string[] {
  const national = e164.replace(/^\+963/, '0');
  return [e164, e164.slice(1), national, national.slice(1)];
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
  await resetDatabase();
  const clock = testClock();
  current = await buildTestApp({
    db: testDb(),
    authDb: testAuthDb(),
    platformDb: testPlatformDb(),
    clock,
    clinicWebUrl: CLINIC_WEB_URL,
    forwardLogs: true,
  });
  const base = await listen(current.app);
  const send = async (method: string, path: string, body?: unknown, cookie?: string) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    return { status: res.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
  };
  const admin = await signedInAdmin(current, clock, ADMIN);
  const created = await createClinicViaApi(current, admin.cookie, OWNER);
  const owner = (await setUpOwner(current, clock, created.linkUrl)).cookie;

  const body = {
    id: randomUUID(),
    givenName: GIVEN,
    fatherName: FATHER,
    familyName: FAMILY,
    motherName: MOTHER,
    contactPhone: CONTACT.replace('+963', '0'),
    secondPhone: SECOND,
    sex: 'female',
    birthDate: BIRTH,
    previousFileNumber: PREVIOUS,
  };
  const status = (r: { status: number }) => r.status;
  // Each path below must really run.
  expect(status(await send('POST', '/patients', body, owner))).toBe(201);
  expect(status(await send('POST', '/patients', body, owner))).toBe(201);
  expect(status(await send('POST', '/patients', { ...body, familyName: NEW_FAMILY }, owner))).toBe(
    409,
  );
  const again = { ...body, id: randomUUID() };
  expect(status(await send('POST', '/patients', again, owner))).toBe(409);
  expect(
    status(
      await send(
        'POST',
        '/patients',
        { ...again, previousFileNumber: null, contactPhone: '09' },
        owner,
      ),
    ),
  ).toBe(400);
  expect(
    status(
      await send(
        'POST',
        '/patients',
        { ...again, previousFileNumber: null, givenName: `${GIVEN}1` },
        owner,
      ),
    ),
  ).toBe(400);
  const read = await send('GET', `/patients/${body.id}`, undefined, owner);
  const at = String(read.json['updatedAt']);
  clock.advanceBy(1000);
  const edit = await send(
    'PATCH',
    `/patients/${body.id}`,
    { expectedUpdatedAt: at, familyName: NEW_FAMILY, contactPhone: EDITED, birthDate: NEW_BIRTH },
    owner,
  );
  expect(edit.status).toBe(200);
  expect(
    status(
      await send(
        'PATCH',
        `/patients/${body.id}`,
        { expectedUpdatedAt: at, familyName: FAMILY },
        owner,
      ),
    ),
  ).toBe(409);
  const next = String(edit.json['updatedAt']);
  const archived = await send(
    'POST',
    `/patients/${body.id}/archive`,
    { expectedUpdatedAt: next },
    owner,
  );
  expect(archived.status).toBe(200);
  const restored = await send(
    'POST',
    `/patients/${body.id}/restore`,
    { expectedUpdatedAt: String(archived.json['updatedAt']) },
    owner,
  );
  expect(restored.status).toBe(200);
  await send('GET', '/patients/count', undefined, owner);
  audited.push('patient.created', 'patient.edited', 'patient.archived', 'patient.restored');
  await new Promise((resolve) => setTimeout(resolve, 100));
  await flushErrors(2000);
});

afterAll(async () => {
  await current.app.close();
  await stopErrorReporting();
  await test.telemetry.shutdown();
});

describe('chart leak test (A-03-02)', () => {
  it('no name, phone, date of birth or previous number appears anywhere', async () => {
    const audit = await superuserDb(workerDatabaseName()).select().from(auditEvent);
    expect(audit.map((r) => r.event)).toEqual(expect.arrayContaining(audited));
    expect((await test.spans()).length).toBeGreaterThan(0);
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
      'audit rows': JSON.stringify(audit),
    };
    const all = [
      ...[CONTACT, SECOND, EDITED].flatMap(spellings),
      GIVEN,
      FATHER,
      FAMILY,
      MOTHER,
      NEW_FAMILY,
      BIRTH,
      NEW_BIRTH,
      PREVIOUS,
    ];
    for (const [store, text] of Object.entries(stores)) {
      for (const secret of all) {
        expect(text.includes(secret), `${store} holds a chart value`).toBe(false);
      }
    }
  });
});
