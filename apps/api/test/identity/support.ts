// Shared helpers for the identity tests (A-01-02): an app with the real identity module on the
// test database, synthetic people with a scrypt password, sign-in and cookie helpers, and the
// audit rows (null-tenant rows are readable by no application role, so the superuser reads them).
import { randomUUID } from 'node:crypto';
import {
  account,
  auditEvent,
  branch,
  roleAssignment,
  session,
  settingValue,
  user,
} from '@shifa/db';
import {
  createTestTenants,
  fixtureId,
  insertMembership,
  superuserDb,
  testAuthDb,
  testDb,
  workerDatabaseName,
} from '@shifa/db/testing';
import { FixedClock } from '@shifa/testing';
import { hashPassword } from 'better-auth/crypto';
import { eq, like } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { SESSION_COOKIE } from '../../src/modules/identity/index.ts';
import { buildTestApp, type TestApp } from '../support.ts';

/** A password that passes every rule; synthetic. */
export const PASSWORD = 'quiet river lamp 42';

export type TenantRole = 'owner' | 'doctor' | 'receptionist' | 'assistant' | 'accountant';

export interface Person {
  userId: string;
  phone: string;
  membershipId?: string;
  branchId?: string;
}

/** A clock that starts at the real time (Better Auth stamps rows with the real Date). */
export function testClock(): FixedClock {
  return new FixedClock(new Date());
}

export async function identityApp(clock: FixedClock = testClock()): Promise<TestApp> {
  return buildTestApp({ db: testDb(), authDb: testAuthDb(), clock });
}

/** Empties the database and writes these tenants (with one branch each). */
export async function resetWithTenants(...tenantIds: string[]): Promise<void> {
  await createTestTenants(...tenantIds);
  for (const tenantId of tenantIds) {
    await testDb().withTenant({ tenantId, userId: fixtureId('seeder') }, async (tx) => {
      await tx
        .insert(branch)
        .values({ id: fixtureId(`branch:${tenantId}`), tenantId, name: 'فرع' });
    });
  }
}

/** A person with a password account; with `tenant`, an active member holding `role` there. */
export async function seedPerson(
  phone: string,
  tenantRole?: { tenantId: string; role: TenantRole },
): Promise<Person> {
  const userId = randomUUID();
  const hash = await hashPassword(PASSWORD);
  await testAuthDb().withAuth(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name: 'شخص تجريبي',
      email: `${userId}@users.shifa.invalid`,
      phoneNumber: phone,
    });
    await tx.insert(account).values({
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hash,
    });
  });
  if (!tenantRole) return { userId, phone };
  const { tenantId, role } = tenantRole;
  const membershipId = randomUUID();
  await testDb().withTenant({ tenantId, userId }, async (tx) => {
    await insertMembership(tx, { id: membershipId, tenantId, phone, userId });
    await tx.insert(roleAssignment).values({ tenantId, membershipId, role, branchId: null });
  });
  return { userId, phone, membershipId, branchId: fixtureId(`branch:${tenantId}`) };
}

/**
 * Sets the clinic's idle limit (owner setting, A-01a criterion 9): since A-02-04 the organization's
 * `session.idle_minutes` in the settings cascade, as the owner's change or the backfill writes it.
 */
export async function setIdleMinutes(tenantId: string, minutes: 15 | 30 | 60): Promise<void> {
  await superuserDb(workerDatabaseName())
    .insert(settingValue)
    .values({ tenantId, scope: 'organization', key: 'session.idle_minutes', value: minutes })
    .onConflictDoUpdate({
      target: [settingValue.tenantId, settingValue.scope, settingValue.scopeId, settingValue.key],
      set: { value: minutes },
    });
}

export interface SignInOptions {
  ip?: string;
  cookie?: string;
  userAgent?: string;
}

export function signIn(
  app: TestApp,
  phone: string,
  password: string = PASSWORD,
  { ip = '203.0.113.10', cookie, userAgent }: SignInOptions = {},
): Promise<LightMyRequestResponse> {
  return app.app.inject({
    method: 'POST',
    url: '/auth/sign-in',
    remoteAddress: ip,
    payload: { phone, password },
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(userAgent ? { 'user-agent': userAgent } : {}),
    },
  });
}

/** The raw Set-Cookie line of the session cookie. */
export function setCookieLine(res: LightMyRequestResponse): string | undefined {
  const raw = res.headers['set-cookie'];
  const lines = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  return lines.find((line) => line.startsWith(`${SESSION_COOKIE}=`));
}

/** `name=value` of the session cookie, ready for a Cookie header. */
export function sessionCookie(res: LightMyRequestResponse): string {
  const line = setCookieLine(res);
  if (!line) throw new Error(`no session cookie (status ${String(res.statusCode)})`);
  return line.split(';')[0] ?? '';
}

export function get(app: TestApp, url: string, cookie?: string) {
  return app.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} });
}

/** Identity audit rows (`auth.*`), oldest first; the fixtures' `clinic.created` rows left out. */
export function auditRows() {
  return superuserDb(workerDatabaseName())
    .select()
    .from(auditEvent)
    .where(like(auditEvent.event, 'auth.%'))
    .orderBy(auditEvent.at);
}

export function sessionRows(userId: string) {
  return testAuthDb().withAuth((tx) => tx.select().from(session).where(eq(session.userId, userId)));
}
