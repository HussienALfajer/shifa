// A-01a criterion 12a (A-01-09): recovery codes left (MFA status, and in the challenge's answer
// after a recovery sign-in) and a new set of ten confirmed with a current TOTP code (replay and
// lock rules of criterion 12; the old set gone; audited); and the named 409 codes that replace
// `conflict` on the MFA routes.
import { fixtureId, syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enrolTotp, errorCode, platformApp, platformAuditRows, post } from '../platform/support.ts';
import type { TestApp } from '../support.ts';
import { get, resetWithTenants, seedPerson, sessionCookie, signIn, testClock } from './support.ts';
import { STEP_MS, totpAt } from './totp.ts';

const TENANT = fixtureId('recovery:tenant');
const phones = syntheticPhones(2026_11_26, 12);
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

interface MfaStatus {
  enrolled: boolean;
  enrolledAt: string | null;
  recoveryCodesLeft: number | null;
}

const status = async (cookie: string) => {
  const res = await get(app, '/auth/mfa', cookie);
  expect(res.statusCode, res.body).toBe(200);
  return res.json<MfaStatus>();
};
const renew = (cookie: string, code: string) =>
  post(app, '/auth/mfa/recovery-codes', { code }, cookie);
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

describe('MFA status and codes left (criterion 12a)', () => {
  it('before enrolment: not enrolled, nulls', async () => {
    const cookie = await doctorCookie(0);
    expect(await status(cookie)).toEqual({
      enrolled: false,
      enrolledAt: null,
      recoveryCodesLeft: null,
    });
  });

  it('after enrolment: enrolled since, ten codes left', async () => {
    const done = await enrolled(1);
    const body = await status(done.cookie);
    expect(body.enrolled).toBe(true);
    expect(body.recoveryCodesLeft).toBe(10);
    expect(Number.isNaN(Date.parse(body.enrolledAt ?? ''))).toBe(false);
  });

  it('a recovery sign-in answers the codes left (nine), and so does the status', async () => {
    const done = await enrolled(2);
    const pending = sessionCookie(await signIn(app, phone(2)));
    const res = await challenge(pending, 'recovery', done.recoveryCodes[0] ?? '');
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ session: { mfa: 'verified' }, recoveryCodesLeft: 9 });
    expect((await status(sessionCookie(res))).recoveryCodesLeft).toBe(9);
  });

  it('a TOTP sign-in answers the codes left too', async () => {
    const done = await enrolled(3);
    const pending = sessionCookie(await signIn(app, phone(3)));
    const res = await challenge(pending, 'totp', totpAt(done.manualKey, clock.now()));
    expect(res.json()).toMatchObject({ session: { mfa: 'verified' }, recoveryCodesLeft: 10 });
  });
});

describe('new recovery codes (criterion 12a)', () => {
  it('a current code gives ten new codes once; the old set is refused, a new one passes once', async () => {
    const done = await enrolled(4);
    const res = await renew(done.cookie, totpAt(done.manualKey, clock.now()));
    expect(res.statusCode, res.body).toBe(200);
    const fresh = res.json<{ recoveryCodes: string[] }>().recoveryCodes;
    expect(new Set(fresh).size).toBe(10);
    expect(fresh.some((c) => done.recoveryCodes.includes(c))).toBe(false);
    expect((await status(done.cookie)).recoveryCodesLeft).toBe(10);

    const pending = sessionCookie(await signIn(app, phone(4)));
    expect(errorCode(await challenge(pending, 'recovery', done.recoveryCodes[1] ?? ''))).toBe(
      'invalid_code',
    );
    expect((await challenge(pending, 'recovery', fresh[0] ?? '')).statusCode).toBe(200);
    const again = sessionCookie(await signIn(app, phone(4)));
    expect(errorCode(await challenge(again, 'recovery', fresh[0] ?? ''))).toBe('invalid_code');
    expect((await platformAuditRows()).map((r) => r.event)).toContain(
      'auth.recovery_codes_renewed',
    );
  });

  it('a replayed code is refused (the step already used)', async () => {
    const done = await enrolled(5);
    const code = totpAt(done.manualKey, clock.now());
    expect((await renew(done.cookie, code)).statusCode).toBe(200);
    const replay = await renew(done.cookie, code);
    expect(replay.statusCode).toBe(400);
    expect(errorCode(replay)).toBe('invalid_code');
  });

  it('wrong codes count: the fifth locks MFA (429 mfa_locked)', async () => {
    const done = await enrolled(6);
    for (let i = 0; i < 4; i += 1) {
      expect(errorCode(await renew(done.cookie, '000000'))).toBe('invalid_code');
    }
    const fifth = await renew(done.cookie, '000000');
    expect(fifth.statusCode).toBe(429);
    expect(errorCode(fifth)).toBe('mfa_locked');
    expect(errorCode(await renew(done.cookie, totpAt(done.manualKey, clock.now())))).toBe(
      'mfa_locked',
    );
  });

  it('without enrolment → 409 mfa_not_enrolled', async () => {
    const cookie = await doctorCookie(7);
    const res = await renew(cookie, '123456');
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('mfa_not_enrolled');
  });

  it('a pending session cannot renew (after MFA only)', async () => {
    await enrolled(8);
    const pending = sessionCookie(await signIn(app, phone(8)));
    expect(errorCode(await renew(pending, '123456'))).toBe('mfa_challenge_required');
  });
});

describe('named MFA 409 codes', () => {
  it('enrol start and confirm when enrolled → mfa_already_enrolled', async () => {
    const done = await enrolled(9);
    const start = await post(app, '/auth/mfa/enrol/start', undefined, done.cookie);
    expect(start.statusCode).toBe(409);
    expect(errorCode(start)).toBe('mfa_already_enrolled');
    const confirm = await post(app, '/auth/mfa/enrol/confirm', { code: '123456' }, done.cookie);
    expect(confirm.statusCode).toBe(409);
    expect(errorCode(confirm)).toBe('mfa_already_enrolled');
  });

  it('confirm without a started enrolment → mfa_not_started', async () => {
    const cookie = await doctorCookie(10);
    const res = await post(app, '/auth/mfa/enrol/confirm', { code: '123456' }, cookie);
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('mfa_not_started');
  });

  it('a challenge when none is owed → mfa_not_owed', async () => {
    const cookie = await doctorCookie(11);
    const res = await challenge(cookie, 'totp', '123456');
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('mfa_not_owed');
  });
});
