// A-03 criterion 6 and "Money, abuse and privacy" for A-03-03: search terms (a name and its
// variant, a typo, a word start, phones in two spellings, a phone tail, a previous file number, a
// term too short, an archived search a receptionist may not make (403), searches past the limit
// (429)) travel in the request body only and appear nowhere: not in local logs, exported spans or
// log records, error events or audit rows. The route is `POST /patients/search`; its URL carries
// no term. Runs in the telemetry project, so query spans are recorded.
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
import { addMember, useMemberLink } from '../team/support.ts';
import { type ErrorSink, errorSink, TEST_DSN } from './error-sink.ts';
import { listen, startTestTelemetry, type TestTelemetry } from './support.ts';

const [ADMIN, OWNER, CONTACT, RECEPTION] = syntheticPhones(2026_12_05, 4) as [
  string,
  string,
  string,
  string,
];
const GIVEN = 'جمانة';
const FAMILY = 'القباني';
const PREVIOUS = 'QB-9031';
const TERMS = [
  'جمانة القباني',
  'جمانه القبانى',
  'جمان',
  'القباني جمانة',
  'جمانة القبامي',
  CONTACT,
  `0${CONTACT.slice(4)}`,
  CONTACT.slice(-8),
  PREVIOUS,
  'ج',
];

let test: TestTelemetry;
let errors: ErrorSink;
let current: TestApp;
const urls: string[] = [];

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
  const send = async (method: string, path: string, body: unknown, cookie: string) => {
    urls.push(path);
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body),
    });
    return res.status;
  };
  const admin = await signedInAdmin(current, clock, ADMIN);
  const created = await createClinicViaApi(current, admin.cookie, OWNER);
  const owner = (await setUpOwner(current, clock, created.linkUrl)).cookie;
  const chart = {
    id: randomUUID(),
    givenName: GIVEN,
    familyName: FAMILY,
    contactPhone: CONTACT,
    sex: 'female',
    birthDate: '1991-06-02',
    previousFileNumber: PREVIOUS,
  };
  expect(await send('POST', '/patients', chart, owner)).toBe(201);
  // Each search below must really run: found, too short, or refused.
  for (const term of TERMS.slice(0, -1)) {
    expect(await send('POST', '/patients/search', { term }, owner), term).toBe(200);
  }
  expect(await send('POST', '/patients/search', { term: 'ج' }, owner)).toBe(400);
  expect(
    await send('POST', '/patients/search', { term: GIVEN, includeArchived: true }, owner),
  ).toBe(200);
  // Refused: a receptionist may not include archived charts (403).
  const added = await addMember(current, owner, {
    phone: RECEPTION,
    roles: [{ role: 'receptionist', branchId: null }],
  });
  const reception = await useMemberLink(current, added.linkUrl);
  expect(
    await send('POST', '/patients/search', { term: FAMILY, includeArchived: true }, reception),
  ).toBe(403);
  // Past the limit (429): the owner's searches above count too.
  let last = 0;
  for (let i = 0; i < 60 && last !== 429; i += 1) {
    last = await send('POST', '/patients/search', { term: `${GIVEN} ${FAMILY}` }, owner);
  }
  expect(last).toBe(429);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await flushErrors(2000);
});

afterAll(async () => {
  await current.app.close();
  await stopErrorReporting();
  await test.telemetry.shutdown();
});

describe('search leak test (A-03-03)', () => {
  it('no search term appears in a URL, log, span, error event or audit row', async () => {
    expect(new Set(urls.filter((u) => u.startsWith('/patients/search')))).toEqual(
      new Set(['/patients/search']),
    );
    const audit = await superuserDb(workerDatabaseName()).select().from(auditEvent);
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
    // The keys the server derives from the terms, too (normalised words and tokens).
    const secrets = [...TERMS.filter((t) => t.length > 1), 'جمانه', 'القباني', 'جمان', 'قباني'];
    for (const [store, text] of Object.entries(stores)) {
      for (const secret of secrets) {
        expect(text.includes(secret), `${store} holds a search term`).toBe(false);
      }
    }
  });
});
