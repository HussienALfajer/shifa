// Regressions for the A-01-03 review: same owner phone while the first owner is pending (OD-85),
// a code older than the last accepted step, parallel challenges with one code, owner actions
// recorded on the auth path, and a seed run that stopped half-way.
import { randomUUID } from 'node:crypto';
import { account, platformAdmin, user } from '@shifa/db';
import {
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testPlatformDb,
  workerDatabaseName,
} from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { eq, isNull } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedSuperAdmin } from '../../src/modules/identity/index.ts';
import { sessionCookie, signIn, testClock } from '../identity/support.ts';
import { STEP_MS, totpAt } from '../identity/totp.ts';
import type { TestApp } from '../support.ts';
import {
  CLINIC_WEB_URL,
  createClinicViaApi,
  errorCode,
  platformApp,
  platformAuditRows,
  post,
  resetDatabase,
  setUpOwner,
  signedInAdmin,
} from './support.ts';

const phones = syntheticPhones(2026_11_30, 10);
const phone = (i: number) => phones[i] ?? '';
const su = () => superuserDb(workerDatabaseName());

let app: TestApp;
let clock: FixedClock;
let admin: { cookie: string; userId: string };

beforeEach(async () => {
  await resetDatabase();
  clock = testClock();
  app = await platformApp(clock);
  admin = await signedInAdmin(app, clock, phone(0));
});

afterEach(async () => {
  await app.app.close();
});

const body = (ownerPhone: string, name = 'عيادة ثانية') => ({
  name,
  type: 'solo',
  status: 'trial',
  ownerName: 'مالك تجريبي',
  ownerPhone,
});

describe('same owner phone while the first owner is pending (OD-85)', () => {
  it('refuses the second clinic until the first owner has set up, then invites', async () => {
    const first = await createClinicViaApi(app, admin.cookie, phone(1));
    const refused = await post(app, '/platform/clinics', body(phone(1)), admin.cookie);
    expect(refused.statusCode).toBe(409);
    expect(errorCode(refused)).toBe('owner_setup_pending');
    expect(
      await su()
        .select()
        .from(user)
        .where(eq(user.phoneNumber, phone(1))),
    ).toHaveLength(0);
    await setUpOwner(app, clock, first.linkUrl);
    const second = await createClinicViaApi(app, admin.cookie, phone(1), { name: 'عيادة ثانية' });
    expect(second.linkPurpose).toBe('invitation');
  });
});

describe('TOTP steps (criterion 12)', () => {
  it('refuses a code at or before the last accepted step, even within ±1', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(2));
    const owner = await setUpOwner(app, clock, created.linkUrl);
    clock.advanceBy(3 * STEP_MS);
    const first = sessionCookie(await signIn(app, phone(2)));
    const ahead = totpAt(owner.manualKey, clock.now(), 1);
    expect(
      (await post(app, '/auth/mfa/challenge', { method: 'totp', code: ahead }, first)).statusCode,
    ).toBe(200);
    const second = sessionCookie(await signIn(app, phone(2)));
    const current = totpAt(owner.manualKey, clock.now());
    const res = await post(app, '/auth/mfa/challenge', { method: 'totp', code: current }, second);
    expect(errorCode(res)).toBe('invalid_code');
  });

  it('one code sent twice in parallel passes once', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(3));
    const owner = await setUpOwner(app, clock, created.linkUrl);
    clock.advanceBy(3 * STEP_MS);
    const a = sessionCookie(await signIn(app, phone(3)));
    const b = sessionCookie(await signIn(app, phone(3)));
    const code = totpAt(owner.manualKey, clock.now());
    const results = await Promise.all(
      [a, b].map((c) => post(app, '/auth/mfa/challenge', { method: 'totp', code }, c)),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 400]);
  });
});

describe('owner actions on the auth path (criterion 13)', () => {
  it('each writes its own auth row with the super admin as actor', async () => {
    const created = await createClinicViaApi(app, admin.cookie, phone(4));
    await setUpOwner(app, clock, created.linkUrl);
    for (const action of ['end-sessions', 'reset-mfa', 'setup-link']) {
      await post(
        app,
        `/platform/clinics/${created.clinicId}/owner/${action}`,
        undefined,
        admin.cookie,
      );
    }
    const rows = (await platformAuditRows()).filter((r) => r.actorId === admin.userId);
    const events = rows.map((r) => r.event);
    expect(events).toContain('auth.mfa_reset');
    expect(events).toContain('auth.password_reset');
    // The admin's own rotations are `rotated`; ending the owner's sessions is `admin`.
    const ended = rows.filter((r) => r.event === 'auth.session_ended').map((r) => r.data);
    expect(ended).toContainEqual({ reason: 'admin' });
  });
});

describe('seed run that stopped half-way (review 5)', () => {
  it('a second run picks up the account it left, never one in use', async () => {
    // As if the platform step had failed: the person exists, no password, no platform_admin.
    const userId = randomUUID();
    await testAuthDb().withAuth((tx) =>
      tx
        .insert(user)
        .values({ id: userId, name: 'م', email: `${userId}@x.invalid`, phoneNumber: phone(5) }),
    );
    const seed = (p: string) =>
      seedSuperAdmin({
        authDb: testAuthDb(),
        platformDb: testPlatformDb(),
        phone: p,
        name: 'مشرف',
        clinicWebUrl: CLINIC_WEB_URL,
      });
    expect((await seed(phone(5))).userId).toBe(userId);
    expect(await su().select().from(platformAdmin)).toHaveLength(2);
    // An owner whose password was reset has a membership: never taken over.
    const created = await createClinicViaApi(app, admin.cookie, phone(6));
    await setUpOwner(app, clock, created.linkUrl);
    await post(
      app,
      `/platform/clinics/${created.clinicId}/owner/setup-link`,
      undefined,
      admin.cookie,
    );
    expect(await su().select().from(account).where(isNull(account.password))).not.toHaveLength(0);
    await expect(seed(phone(6))).rejects.toThrow(/already exists/);
  });
});
