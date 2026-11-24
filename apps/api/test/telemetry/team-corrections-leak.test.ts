// A-01b "Money, abuse and privacy" for A-01-12: synthetic phones, setup tokens and typed names go
// through toggles on add, a pending member's phone edit (refused: invalid, taken, accepted; then
// changed to a new phone and to a phone with an account), a rename, an invitation answered by a
// person signed in with another number, and a branch restore; then appear nowhere: not in local
// logs, exported spans or log records, error events, or audit rows.
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
import { PASSWORD, seedPerson, sessionCookie, signIn, testClock } from '../identity/support.ts';
import {
  CLINIC_WEB_URL,
  createClinicViaApi,
  resetDatabase,
  setUpOwner,
  signedInAdmin,
  tokenOf,
} from '../platform/support.ts';
import { buildTestApp, type TestApp } from '../support.ts';
import { useMemberLink } from '../team/support.ts';
import { type ErrorSink, errorSink, TEST_DSN } from './error-sink.ts';
import { listen, startTestTelemetry, type TestTelemetry } from './support.ts';

const [ADMIN, OWNER, PENDING, CORRECTED, ACCOUNT, ACTIVE, STRANGER] = syntheticPhones(
  2026_12_14,
  7,
) as [string, string, string, string, string, string, string];
const TYPED_NAME = 'سلمى المصححة';

let test: TestTelemetry;
let errors: ErrorSink;
let current: TestApp;
const secrets: string[] = [];

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
  secrets.push(tokenOf(created.linkUrl));
  const owner = (await setUpOwner(current, clock, created.linkUrl)).cookie;

  const add = async (phone: string, role: string) => {
    const res = await send(
      'POST',
      '/team/members',
      {
        name: TYPED_NAME,
        phone,
        roles: [{ role, branchId: null }],
        permissions: [{ key: 'clinical.notes.view', granted: role !== 'doctor' }],
      },
      owner,
    );
    const body = res.json as { member: { id: string }; link: { url: string } };
    secrets.push(tokenOf(body.link.url));
    return body;
  };
  await send('GET', '/team/permissions', undefined, owner);
  const pending = await add(PENDING, 'doctor');
  const active = await add(ACTIVE, 'receptionist');
  await useMemberLink(current, active.link.url);

  const phone = (id: string, value: string) =>
    send('PATCH', `/team/members/${id}/phone`, { phone: value }, owner);
  const code = (r: { status: number; json: Record<string, unknown> }) => [
    r.status,
    (r.json['error'] as { code?: string } | undefined)?.code,
  ];
  // Each path below must really run (security review L3).
  expect(code(await phone(pending.member.id, `${CORRECTED}99`))).toEqual([
    400,
    'validation_failed',
  ]);
  expect(code(await phone(pending.member.id, ACTIVE))).toEqual([409, 'phone_in_team']);
  expect(code(await phone(active.member.id, CORRECTED))).toEqual([409, 'member_account_exists']);
  const changed = await phone(pending.member.id, CORRECTED);
  if (changed.status !== 200) throw new Error(`phone: ${String(changed.status)}`);
  secrets.push(tokenOf(String(changed.json['url'])));
  await seedPerson(ACCOUNT);
  const invited = await phone(pending.member.id, ACCOUNT);
  const token = tokenOf(String(invited.json['url']));
  secrets.push(token);
  await send('PATCH', `/team/members/${pending.member.id}`, { name: `  ${TYPED_NAME} ` }, owner);
  await send('GET', '/team/members', undefined, owner);

  // OD-104: a stranger signed in with another number, then the invited person.
  await seedPerson(STRANGER);
  const stranger = sessionCookie(await signIn(current, STRANGER, PASSWORD));
  await send('POST', '/invitations/view', { token });
  for (const action of ['accept', 'decline']) {
    expect(code(await send('POST', `/invitations/${action}`, { token }, stranger))).toEqual([
      403,
      'invitation_other_phone',
    ]);
  }
  const person = sessionCookie(await signIn(current, ACCOUNT, PASSWORD));
  expect((await send('POST', '/invitations/accept', { token }, person)).status).toBe(204);

  // OD-105.
  const branch = await send('POST', '/branches', { name: 'فرع', phone: CORRECTED }, owner);
  const branchId = String(branch.json['id']);
  await send('POST', `/branches/${branchId}/archive`, {}, owner);
  await send('POST', `/branches/${branchId}/restore`, {}, owner);
  await send('POST', `/branches/${branchId}/restore`, {}, owner);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await flushErrors(2000);
});

afterAll(async () => {
  await current.app.close();
  await stopErrorReporting();
  await test.telemetry.shutdown();
});

describe('team corrections leak test (A-01-12)', () => {
  it('no phone, token or typed name appears anywhere', async () => {
    const audit = await superuserDb(workerDatabaseName()).select().from(auditEvent);
    const events = audit.map((r) => r.event);
    expect(events).toEqual(
      expect.arrayContaining(['member.phone_changed', 'member.renamed', 'branch.restored']),
    );
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
      ...[ADMIN, OWNER, PENDING, CORRECTED, ACCOUNT, ACTIVE, STRANGER].flatMap(spellings),
      TYPED_NAME,
      ...secrets,
    ];
    expect(secrets.length).toBe(5);
    for (const [store, text] of Object.entries(stores)) {
      for (const secret of all) {
        expect(text.includes(secret), `${store} holds a secret`).toBe(false);
      }
    }
  });
});
