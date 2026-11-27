// Helpers for the A-01-03 tests: an app with all three pools, a super admin created by the seed
// command and taken through the setup link and TOTP enrolment, clinics created through the API,
// and the token of a setup link URL.
import { createHash } from 'node:crypto';
import { auditEvent, setupLink } from '@shifa/db';
import {
  resetTestDb,
  superuserDb,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { like, or } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { seedSuperAdmin } from '../../src/modules/identity/index.ts';
import { PASSWORD, sessionCookie, testClock } from '../identity/support.ts';
import { totpAt } from '../identity/totp.ts';
import { buildTestApp, type TestApp } from '../support.ts';

export const CLINIC_WEB_URL = 'https://clinic.shifa.invalid';

/** Extra test controllers and catalogue keys (A-02-03: gated probes, test flags; A-02-04: settings). */
export type PlatformAppOptions = Pick<
  Parameters<typeof buildTestApp>[0],
  'controllers' | 'entitlements' | 'flags' | 'settings'
>;

export async function platformApp(
  clock: FixedClock = testClock(),
  options: PlatformAppOptions = {},
): Promise<TestApp> {
  return buildTestApp({
    db: testDb(),
    authDb: testAuthDb(),
    platformDb: testPlatformDb(),
    clock,
    clinicWebUrl: CLINIC_WEB_URL,
    ...options,
  });
}

/** Empties the database (no tenants and no audit rows). */
export async function resetDatabase(): Promise<void> {
  await resetTestDb();
}

/** The token of a setup link URL (`…/setup#<token>`). */
export function tokenOf(url: string): string {
  const token = url.split('#')[1];
  if (!token) throw new Error('setup link without a token');
  return token;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function post(app: TestApp, url: string, body?: unknown, cookie?: string) {
  return app.app.inject({
    method: 'POST',
    url,
    headers: cookie ? { cookie } : {},
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
  });
}

export function patch(app: TestApp, url: string, body: unknown, cookie?: string) {
  return app.app.inject({
    method: 'PATCH',
    url,
    headers: cookie ? { cookie } : {},
    payload: body as Record<string, unknown>,
  });
}

export function errorCode(res: LightMyRequestResponse): string | undefined {
  return res.json<{ error?: { code?: string } }>().error?.code;
}

export interface Enrolled {
  /** Session cookie after the MFA step (rotated). */
  cookie: string;
  manualKey: string;
  recoveryCodes: string[];
}

/** Enrols TOTP for the session behind `cookie` and confirms it with the current code. */
export async function enrolTotp(
  app: TestApp,
  cookie: string,
  clock: FixedClock,
): Promise<Enrolled> {
  const start = await post(app, '/auth/mfa/enrol/start', undefined, cookie);
  if (start.statusCode !== 200) throw new Error(`enrol start: ${String(start.statusCode)}`);
  const { manualKey } = start.json<{ manualKey: string }>();
  const confirm = await post(
    app,
    '/auth/mfa/enrol/confirm',
    { code: totpAt(manualKey, clock.now()) },
    cookie,
  );
  if (confirm.statusCode !== 200) throw new Error(`enrol confirm: ${String(confirm.statusCode)}`);
  const { recoveryCodes } = confirm.json<{ recoveryCodes: string[] }>();
  return { cookie: sessionCookie(confirm), manualKey, recoveryCodes };
}

export interface SignedInAdmin extends Enrolled {
  userId: string;
  phone: string;
}

/** A super admin from the seed command, through the link, password and TOTP enrolment. */
export async function signedInAdmin(
  app: TestApp,
  clock: FixedClock,
  phone: string,
): Promise<SignedInAdmin> {
  const seeded = await seedSuperAdmin({
    authDb: testAuthDb(),
    platformDb: testPlatformDb(),
    phone,
    name: 'مشرف تجريبي',
    clock,
    clinicWebUrl: CLINIC_WEB_URL,
  });
  const consumed = await post(app, '/auth/setup-link/consume', {
    token: tokenOf(seeded.setupUrl),
    password: PASSWORD,
  });
  if (consumed.statusCode !== 200) {
    throw new Error(`admin link: ${String(consumed.statusCode)} ${consumed.body}`);
  }
  const enrolled = await enrolTotp(app, sessionCookie(consumed), clock);
  return { ...enrolled, userId: seeded.userId, phone };
}

export interface CreatedClinic {
  clinicId: string;
  ownerMembershipId: string;
  linkUrl: string;
  whatsappUrl: string;
  linkPurpose: string;
  expiresAt: string;
}

export const CLINIC_NAME = 'عيادة الشفاء التخصصية';

/** Creates a clinic and its owner through the API as the super admin behind `cookie`. */
export async function createClinicViaApi(
  app: TestApp,
  cookie: string,
  ownerPhone: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedClinic> {
  const res = await post(
    app,
    '/platform/clinics',
    {
      name: CLINIC_NAME,
      type: 'multi_doctor',
      status: 'trial',
      subscriptionEnd: '2027-06-30',
      ownerName: 'مالك تجريبي',
      ownerPhone,
      ...overrides,
    },
    cookie,
  );
  if (res.statusCode !== 201)
    throw new Error(`create clinic: ${String(res.statusCode)} ${res.body}`);
  const body = res.json<{
    clinic: { id: string; owner: { membershipId: string } };
    ownerLink: { url: string; whatsappUrl: string; purpose: string; expiresAt: string };
  }>();
  return {
    clinicId: body.clinic.id,
    ownerMembershipId: body.clinic.owner.membershipId,
    linkUrl: body.ownerLink.url,
    whatsappUrl: body.ownerLink.whatsappUrl,
    linkPurpose: body.ownerLink.purpose,
    expiresAt: body.ownerLink.expiresAt,
  };
}

/** The clinic's owner, through the link, a password and TOTP. */
export async function setUpOwner(
  app: TestApp,
  clock: FixedClock,
  linkUrl: string,
): Promise<Enrolled> {
  const consumed = await post(app, '/auth/setup-link/consume', {
    token: tokenOf(linkUrl),
    password: PASSWORD,
  });
  if (consumed.statusCode !== 200) throw new Error(`owner link: ${String(consumed.statusCode)}`);
  return enrolTotp(app, sessionCookie(consumed), clock);
}

/** Platform and identity audit rows (null tenant), oldest first. */
export function platformAuditRows() {
  return superuserDb(workerDatabaseName())
    .select()
    .from(auditEvent)
    .where(
      or(
        like(auditEvent.event, 'clinic.%'),
        like(auditEvent.event, 'owner.%'),
        like(auditEvent.event, 'platform.%'),
        like(auditEvent.event, 'entitlement.%'),
        like(auditEvent.event, 'auth.%'),
      ),
    )
    .orderBy(auditEvent.at);
}

/** Every setup link row (superuser). */
export function linkRows() {
  return superuserDb(workerDatabaseName()).select().from(setupLink);
}
