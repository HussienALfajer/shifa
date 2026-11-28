// A-03 "Money, abuse and privacy" for A-03-06: custom field values and labels go through a
// registration (and a refused one: a misfit value, a field the member may not edit), a read, an
// edit, a search by a searchable value and the owner's counts; then appear nowhere: not in local
// logs, exported spans or log records, error events, or audit rows. Paths carry ids and keys only.
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

const [ADMIN, OWNER, CONTACT] = syntheticPhones(2026_12_13, 3) as [string, string, string];
const LABEL = 'رقم بطاقة التأمين';
const SECRET_LABEL = 'ملاحظة مالية خاصة';
const CARD = 'بطاقة-ذهبية-8841';
const NEW_CARD = 'بطاقة-فضية-7732';

let test: TestTelemetry;
let errors: ErrorSink;
let current: TestApp;

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
  const roles = ['owner', 'receptionist'];
  const field = await send(
    'POST',
    '/patients/fields',
    {
      label: LABEL,
      type: 'text',
      section: 'إداري',
      viewRoles: roles,
      editRoles: roles,
      searchable: true,
    },
    owner,
  );
  expect(field.status).toBe(201);
  const key = String(field.json['key']);
  const hidden = await send(
    'POST',
    '/patients/fields',
    { label: SECRET_LABEL, type: 'number', section: 'مالي', viewRoles: ['owner'], editRoles: [] },
    owner,
  );
  expect(hidden.status).toBe(201);
  const body = {
    id: randomUUID(),
    givenName: 'نسرين',
    contactPhone: CONTACT,
    sex: 'female',
    birthDate: '1987-04-19',
    fields: { [key]: CARD },
  };
  expect((await send('POST', '/patients', body, owner)).status).toBe(201);
  const refused = { ...body, id: randomUUID(), fields: { [key]: ['x'] } };
  expect((await send('POST', '/patients', refused, owner)).status).toBe(400);
  const notEditable = { ...body, id: randomUUID(), fields: { [String(hidden.json['key'])]: 9915 } };
  expect((await send('POST', '/patients', notEditable, owner)).status).toBe(403);
  const read = await send('GET', `/patients/${body.id}`, undefined, owner);
  const edited = await send(
    'PATCH',
    `/patients/${body.id}`,
    { expectedUpdatedAt: String(read.json['updatedAt']), fields: { [key]: NEW_CARD } },
    owner,
  );
  expect(edited.status).toBe(200);
  const found = await send('POST', '/patients/search', { term: NEW_CARD }, owner);
  expect(JSON.stringify(found.json)).toContain(body.id);
  expect((await send('GET', '/patients/fields/definitions', undefined, owner)).status).toBe(200);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await flushErrors(2000);
});

afterAll(async () => {
  await current.app.close();
  await stopErrorReporting();
  await test.telemetry.shutdown();
});

describe('field value leak test (A-03-06)', () => {
  it('no value or label appears anywhere', async () => {
    const audit = await superuserDb(workerDatabaseName()).select().from(auditEvent);
    expect(audit.map((r) => r.event)).toEqual(
      expect.arrayContaining(['patient.created', 'patient.edited']),
    );
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
    for (const [store, text] of Object.entries(stores)) {
      for (const secret of [LABEL, SECRET_LABEL, CARD, NEW_CARD]) {
        expect(text.includes(secret), `${store} holds a field value or label`).toBe(false);
      }
    }
  });
});
