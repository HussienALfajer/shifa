// A-01a criterion 11, OD-98, OD-101 (A-01-11): an enrolled person moves TOTP to a new phone. The
// start takes a current code from the old app (replay and lock rules of criterion 12) and
// answers a new key; the old secret keeps working until a code from the new app confirms it;
// the confirm answers ten new recovery codes and the old set is gone; other sessions are kept;
// audited. A reset by the super admin during a pending re-enrolment removes both secrets.
import { twoFactor, user } from '@shifa/db';
import { fixtureId, superuserDb, syntheticPhones, workerDatabaseName } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createClinicViaApi,
  enrolTotp,
  errorCode,
  platformApp,
  platformAuditRows,
  post,
  setUpOwner,
  signedInAdmin,
} from '../platform/support.ts';
import type { TestApp } from '../support.ts';
import { get, resetWithTenants, seedPerson, sessionCookie, signIn, testClock } from './support.ts';
import { STEP_MS, totpAt } from './totp.ts';

const TENANT = fixtureId('reenrol:tenant');
const phones = syntheticPhones(2026_11_27, 20);
const phone = (i: number) => phones[i] ?? '';

let app: TestApp;
let clock: FixedClock;

beforeEach(async () => {
  await resetWithTenants(TENANT);
  clock = testClock();
  app = await platformApp(clock);
});

afterEach(async () => {
  await app.app.close();
});

const start = (cookie: string, code: string) =>
  post(app, '/auth/mfa/re-enrol/start', { code }, cookie);
const confirm = (cookie: string, code: string) =>
  post(app, '/auth/mfa/re-enrol/confirm', { code }, cookie);
const challenge = (cookie: string, method: 'totp' | 'recovery', code: string) =>
  post(app, '/auth/mfa/challenge', { method, code }, cookie);

async function doctorCookie(i: number): Promise<string> {
  await seedPerson(phone(i), { tenantId: TENANT, role: 'doctor' });
  return sessionCookie(await signIn(app, phone(i)));
}

/** A doctor with TOTP, verified in this session; the clock two steps past enrolment. */
async function enrolled(i: number) {
  const done = await enrolTotp(app, await doctorCookie(i), clock);
  clock.advanceBy(2 * STEP_MS);
  return done;
}

/** Starts a re-enrolment with the old app's current code; the new key. */
async function started(cookie: string, oldKey: string): Promise<string> {
  const res = await start(cookie, totpAt(oldKey, clock.now()));
  expect(res.statusCode, res.body).toBe(200);
  const body = res.json<{ manualKey: string; otpauthUri: string }>();
  expect(body.otpauthUri).toContain(body.manualKey);
  expect(body.manualKey).not.toBe(oldKey);
  return body.manualKey;
}

/** A new sign-in of person `i` (pending MFA). */
const pendingSession = async (i: number) => sessionCookie(await signIn(app, phone(i)));

describe('re-enrolment start (OD-98)', () => {
  it('without enrolment → 409 mfa_not_enrolled, on start and on confirm', async () => {
    const cookie = await doctorCookie(0);
    const res = await start(cookie, '123456');
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('mfa_not_enrolled');
    const conf = await confirm(cookie, '123456');
    expect(conf.statusCode).toBe(409);
    expect(errorCode(conf)).toBe('mfa_not_enrolled');
  });

  it('a wrong code is counted: the fifth locks MFA (429 mfa_locked with until)', async () => {
    const done = await enrolled(1);
    for (let i = 0; i < 4; i += 1) {
      const res = await start(done.cookie, '000000');
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe('invalid_code');
    }
    const fifth = await start(done.cookie, '000000');
    expect(fifth.statusCode).toBe(429);
    expect(errorCode(fifth)).toBe('mfa_locked');
    expect(Number.isNaN(Date.parse(fifth.json<{ error: { until: string } }>().error.until))).toBe(
      false,
    );
    expect(errorCode(await start(done.cookie, totpAt(done.manualKey, clock.now())))).toBe(
      'mfa_locked',
    );
  });

  it('a replayed code is refused', async () => {
    const done = await enrolled(2);
    const code = totpAt(done.manualKey, clock.now());
    expect((await start(done.cookie, code)).statusCode).toBe(200);
    const replay = await start(done.cookie, code);
    expect(replay.statusCode).toBe(400);
    expect(errorCode(replay)).toBe('invalid_code');
  });

  it('a second start replaces the pending key', async () => {
    const done = await enrolled(3);
    const first = await started(done.cookie, done.manualKey);
    clock.advanceBy(STEP_MS);
    const second = await started(done.cookie, done.manualKey);
    expect(second).not.toBe(first);
    const stale = await confirm(done.cookie, totpAt(first, clock.now()));
    expect(stale.statusCode).toBe(400);
    expect(errorCode(stale)).toBe('invalid_code');
    expect((await confirm(done.cookie, totpAt(second, clock.now()))).statusCode).toBe(200);
  });

  it('while pending, the challenge takes the old secret and not the new one', async () => {
    const done = await enrolled(4);
    const fresh = await started(done.cookie, done.manualKey);
    clock.advanceBy(STEP_MS);
    const pending = await pendingSession(4);
    expect(errorCode(await challenge(pending, 'totp', totpAt(fresh, clock.now())))).toBe(
      'invalid_code',
    );
    expect((await challenge(pending, 'totp', totpAt(done.manualKey, clock.now()))).statusCode).toBe(
      200,
    );
  });

  it('a session before MFA cannot start (after MFA only)', async () => {
    await enrolled(5);
    const pending = await pendingSession(5);
    expect(errorCode(await start(pending, '123456'))).toBe('mfa_challenge_required');
    expect(errorCode(await confirm(pending, '123456'))).toBe('mfa_challenge_required');
  });
});

describe('re-enrolment confirm (OD-98)', () => {
  it('without a start → 409 mfa_not_started', async () => {
    const done = await enrolled(6);
    const res = await confirm(done.cookie, totpAt(done.manualKey, clock.now()));
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('mfa_not_started');
  });

  it('wrong codes on start and confirm count toward one lock', async () => {
    const done = await enrolled(7);
    await started(done.cookie, done.manualKey);
    for (let i = 0; i < 2; i += 1) {
      expect(errorCode(await start(done.cookie, '000000'))).toBe('invalid_code');
    }
    for (let i = 0; i < 2; i += 1) {
      expect(errorCode(await confirm(done.cookie, '000000'))).toBe('invalid_code');
    }
    const fifth = await confirm(done.cookie, '000000');
    expect(fifth.statusCode).toBe(429);
    expect(errorCode(fifth)).toBe('mfa_locked');
  });

  it('a code from a new app whose clock is 2–10 steps off → 400 clock_skew', async () => {
    const done = await enrolled(8);
    const fresh = await started(done.cookie, done.manualKey);
    const res = await confirm(done.cookie, totpAt(fresh, clock.now(), 4));
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('clock_skew');
  });

  it('confirms in the same time step as the start’s code; the new secret replaces the old', async () => {
    const done = await enrolled(9);
    const before = (await get(app, '/auth/mfa', done.cookie)).json<{ enrolledAt: string }>();
    const fresh = await started(done.cookie, done.manualKey);
    const res = await confirm(done.cookie, totpAt(fresh, clock.now()));
    expect(res.statusCode, res.body).toBe(200);
    // The second factor is unchanged in kind: this session is not rotated (OD-101).
    expect(res.headers['set-cookie']).toBeUndefined();
    const codes = res.json<{ recoveryCodes: string[] }>().recoveryCodes;
    expect(new Set(codes).size).toBe(10);
    expect(codes.some((c) => done.recoveryCodes.includes(c))).toBe(false);

    const status = (await get(app, '/auth/mfa', done.cookie)).json<{
      enrolled: boolean;
      enrolledAt: string;
      recoveryCodesLeft: number;
    }>();
    expect(status).toMatchObject({ enrolled: true, recoveryCodesLeft: 10 });
    expect(Date.parse(status.enrolledAt)).toBeGreaterThan(Date.parse(before.enrolledAt));

    clock.advanceBy(STEP_MS);
    const a = await pendingSession(9);
    expect(errorCode(await challenge(a, 'totp', totpAt(done.manualKey, clock.now())))).toBe(
      'invalid_code',
    );
    const newCode = totpAt(fresh, clock.now());
    expect((await challenge(a, 'totp', newCode)).statusCode).toBe(200);
    const b = await pendingSession(9);
    expect(errorCode(await challenge(b, 'totp', newCode))).toBe('invalid_code');
    expect(errorCode(await challenge(b, 'recovery', done.recoveryCodes[0] ?? ''))).toBe(
      'invalid_code',
    );
    expect((await challenge(b, 'recovery', codes[0] ?? '')).statusCode).toBe(200);
    const c = await pendingSession(9);
    expect(errorCode(await challenge(c, 'recovery', codes[0] ?? ''))).toBe('invalid_code');

    const rows = (await platformAuditRows()).filter((r) => r.event === 'auth.mfa_reenrolled');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actorId).toBe(rows[0]?.targetId);
    expect(rows[0]?.data).toEqual({});
  });

  it('keeps the person’s other sessions and this one (OD-101)', async () => {
    const done = await enrolled(10);
    clock.advanceBy(STEP_MS);
    const other = await pendingSession(10);
    const passed = await challenge(other, 'totp', totpAt(done.manualKey, clock.now()));
    expect(passed.statusCode).toBe(200);
    const otherCookie = sessionCookie(passed);
    clock.advanceBy(STEP_MS);
    const fresh = await started(done.cookie, done.manualKey);
    expect((await confirm(done.cookie, totpAt(fresh, clock.now()))).statusCode).toBe(200);
    expect((await get(app, '/auth/session', otherCookie)).statusCode).toBe(200);
    expect((await get(app, '/auth/session', done.cookie)).statusCode).toBe(200);
  });
});

describe('a reset during a pending re-enrolment (criterion 13)', () => {
  it('the super admin’s MFA reset removes the old and the pending secret', async () => {
    const admin = await signedInAdmin(app, clock, phone(11));
    const created = await createClinicViaApi(app, admin.cookie, phone(12));
    const owner = await setUpOwner(app, clock, created.linkUrl);
    clock.advanceBy(2 * STEP_MS);
    await started(owner.cookie, owner.manualKey);
    const reset = await post(
      app,
      `/platform/clinics/${created.clinicId}/owner/reset-mfa`,
      undefined,
      admin.cookie,
    );
    expect(reset.statusCode, reset.body).toBe(204);
    const rows = await superuserDb(workerDatabaseName())
      .select({ id: twoFactor.id })
      .from(twoFactor)
      .innerJoin(user, eq(user.id, twoFactor.userId))
      .where(eq(user.phoneNumber, phone(12)));
    expect(rows).toEqual([]);
  });
});
