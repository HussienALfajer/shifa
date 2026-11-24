// A-01a "Money, abuse and privacy" for A-01-03: synthetic phones, setup tokens, TOTP secrets and
// codes, recovery codes and passwords go through clinic creation, the link view and use, a refused
// password, TOTP enrolment, wrong and right codes, a recovery code and the owner resets, and then
// appear nowhere: not in local logs, exported spans or log records, error events, or audit rows.
import { JsonLogsSerializer, JsonTraceSerializer } from '@opentelemetry/otlp-transformer';
import { syntheticPhones, testAuthDb, testDb, testPlatformDb } from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedSuperAdmin } from '../../src/modules/identity/index.ts';
import {
  flushErrors,
  startErrorReporting,
  stopErrorReporting,
} from '../../src/telemetry/errors.ts';
import { PASSWORD, testClock } from '../identity/support.ts';
import { STEP_MS, totpAt } from '../identity/totp.ts';
import { CLINIC_WEB_URL, platformAuditRows, resetDatabase, tokenOf } from '../platform/support.ts';
import { buildTestApp, type TestApp } from '../support.ts';
import { type ErrorSink, errorSink, TEST_DSN } from './error-sink.ts';
import { listen, startTestTelemetry, type TestTelemetry } from './support.ts';

const [ADMIN_PHONE = '', OWNER_PHONE = ''] = syntheticPhones(2026_11_26, 2);
const REFUSED_PASSWORD = 'short7';
const NEW_PASSWORD = 'amber window crane 77';

let test: TestTelemetry;
let errors: ErrorSink;
let current: TestApp;
const secrets: string[] = [];
const codes: string[] = [];

function spellings(e164: string): string[] {
  const national = e164.replace(/^\+963/, '0').replace(/^\+90/, '0');
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
    const setCookie = (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const text = await res.text();
    return {
      status: res.status,
      cookie: setCookie,
      json: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    };
  };
  const enrol = async (cookie: string) => {
    const start = await send('POST', '/auth/mfa/enrol/start', undefined, cookie);
    const manualKey = String(start.json['manualKey']);
    secrets.push(manualKey);
    const code = totpAt(manualKey, clock.now());
    codes.push(code);
    const confirm = await send('POST', '/auth/mfa/enrol/confirm', { code }, cookie);
    const recovery = confirm.json['recoveryCodes'] as string[];
    secrets.push(...recovery);
    return { cookie: confirm.cookie, manualKey, recovery };
  };

  const seeded = await seedSuperAdmin({
    authDb: testAuthDb(),
    platformDb: testPlatformDb(),
    phone: ADMIN_PHONE,
    name: 'مشرف تجريبي',
    clock,
    clinicWebUrl: CLINIC_WEB_URL,
  });
  secrets.push(tokenOf(seeded.setupUrl));
  const adminLink = await send('POST', '/auth/setup-link/consume', {
    token: tokenOf(seeded.setupUrl),
    password: PASSWORD,
  });
  const admin = await enrol(adminLink.cookie);

  const created = await send(
    'POST',
    '/platform/clinics',
    {
      name: 'عيادة تجريبية',
      type: 'solo',
      status: 'trial',
      ownerName: 'مالك',
      ownerPhone: OWNER_PHONE,
    },
    admin.cookie,
  );
  const clinic = created.json['clinic'] as { id: string };
  const link = created.json['ownerLink'] as { url: string };
  const token = tokenOf(link.url);
  secrets.push(token);
  await send('POST', '/auth/setup-link/view', { token });
  await send('POST', '/auth/setup-link/consume', { token, password: REFUSED_PASSWORD });
  const owner = await send('POST', '/auth/setup-link/consume', { token, password: PASSWORD });
  const enrolled = await enrol(owner.cookie);
  clock.advanceBy(2 * STEP_MS);
  const pending = await send('POST', '/auth/sign-in', { phone: OWNER_PHONE, password: PASSWORD });
  await send('POST', '/auth/mfa/challenge', { method: 'totp', code: '000000' }, pending.cookie);
  const passed = await send(
    'POST',
    '/auth/mfa/challenge',
    { method: 'recovery', code: enrolled.recovery[0] },
    pending.cookie,
  );
  // A-01-09: profile, MFA status, new recovery codes, change of password.
  await send('GET', '/me', undefined, passed.cookie);
  await send('GET', '/auth/mfa', undefined, passed.cookie);
  await send('POST', '/auth/mfa/recovery-codes', { code: '000000' }, passed.cookie);
  clock.advanceBy(STEP_MS);
  const renewCode = totpAt(enrolled.manualKey, clock.now());
  codes.push(renewCode);
  const renewed = await send(
    'POST',
    '/auth/mfa/recovery-codes',
    { code: renewCode },
    passed.cookie,
  );
  secrets.push(...((renewed.json['recoveryCodes'] as string[] | undefined) ?? []));
  const changePassword = (currentPassword: string, newPassword: string) =>
    send('POST', '/auth/password', { currentPassword, newPassword }, passed.cookie);
  await changePassword(REFUSED_PASSWORD, NEW_PASSWORD);
  await changePassword(PASSWORD, REFUSED_PASSWORD);
  await changePassword(PASSWORD, NEW_PASSWORD);
  const reissued = await send(
    'POST',
    `/platform/clinics/${clinic.id}/owner/setup-link`,
    undefined,
    admin.cookie,
  );
  secrets.push(tokenOf(String(reissued.json['url'])));
  await send('POST', `/platform/clinics/${clinic.id}/owner/reset-mfa`, undefined, admin.cookie);
  await send('POST', `/platform/clinics/${clinic.id}/owner/end-sessions`, undefined, admin.cookie);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await flushErrors(2000);
});

afterAll(async () => {
  await current.app.close();
  await stopErrorReporting();
  await test.telemetry.shutdown();
});

describe('setup link and MFA leak test', () => {
  it('produced telemetry and audit rows to search', async () => {
    expect(secrets.length).toBeGreaterThan(30);
    expect((await test.spans()).length).toBeGreaterThan(0);
    expect((await platformAuditRows()).length).toBeGreaterThan(5);
  });

  it('no phone, token, secret, code or password appears anywhere', async () => {
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
      'audit rows': JSON.stringify(await platformAuditRows()),
    };
    const all = [
      ...spellings(ADMIN_PHONE),
      ...spellings(OWNER_PHONE),
      PASSWORD,
      REFUSED_PASSWORD,
      NEW_PASSWORD,
      ...secrets,
    ];
    for (const [store, text] of Object.entries(stores)) {
      for (const secret of all) {
        expect(text.includes(secret), `${store} holds a secret`).toBe(false);
      }
      // Six digits can occur by chance (ids, times): look for a code as a value of its own.
      for (const code of [...codes, '000000']) {
        expect(new RegExp(`["=:]${code}["&,}]`).test(text), `${store} holds a code`).toBe(false);
      }
    }
  });
});
