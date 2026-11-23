// A-01a criteria 11 and 12: owners and super admins reach nothing but enrolment until TOTP is
// enrolled (QR URI + manual key, one code, 10 single-use recovery codes shown once); a code is
// accepted within ±1 step and never twice; five wrong codes lock MFA for 15 min; a used recovery
// code is gone; the session is rotated after MFA; other staff may enrol and are not forced.
import { twoFactor } from '@shifa/db';
import { fixtureId, superuserDb, syntheticPhones, workerDatabaseName } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enrolTotp, errorCode, platformApp, platformAuditRows, post } from '../platform/support.ts';
import type { TestApp } from '../support.ts';
import { get, resetWithTenants, seedPerson, sessionCookie, signIn, testClock } from './support.ts';
import { STEP_MS, totpAt } from './totp.ts';

const MINUTE = 60_000;
const TENANT = fixtureId('mfa:tenant');
const phones = syntheticPhones(2026_11_24, 12);
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

async function ownerCookie(i: number): Promise<string> {
  await seedPerson(phone(i), { tenantId: TENANT, role: 'owner' });
  return sessionCookie(await signIn(app, phone(i)));
}

/** An owner with TOTP enrolled, signed in again (mfa pending). */
async function enrolledOwner(i: number) {
  const enrolled = await enrolTotp(app, await ownerCookie(i), clock);
  // Two steps on, so a code one step back is not the enrolment code replayed.
  clock.advanceBy(2 * STEP_MS);
  const pending = sessionCookie(await signIn(app, phone(i)));
  return { ...enrolled, pending };
}

const challenge = (cookie: string, method: 'totp' | 'recovery', code: string) =>
  post(app, '/auth/mfa/challenge', { method, code }, cookie);

describe('forced enrolment (criterion 11)', () => {
  it('an owner without TOTP reaches only the session view, sign-out and enrolment', async () => {
    const cookie = await ownerCookie(0);
    const session = await get(app, '/auth/session', cookie);
    expect(session.json()).toMatchObject({ mfa: 'none', mfaRequired: true });
    const res = await get(app, '/auth/sessions', cookie);
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('mfa_enrolment_required');
    expect((await post(app, '/auth/sign-out', undefined, cookie)).statusCode).toBe(204);
  });

  it('other staff are not forced and may enrol from their account', async () => {
    await seedPerson(phone(1), { tenantId: TENANT, role: 'doctor' });
    const cookie = sessionCookie(await signIn(app, phone(1)));
    expect((await get(app, '/auth/session', cookie)).json()).toMatchObject({
      mfa: 'none',
      mfaRequired: false,
    });
    expect((await get(app, '/auth/sessions', cookie)).statusCode).toBe(200);
    const enrolled = await enrolTotp(app, cookie, clock);
    expect(enrolled.recoveryCodes).toHaveLength(10);
    // Once enrolled, a doctor passes the challenge at every sign-in too.
    clock.advanceBy(STEP_MS);
    const pending = sessionCookie(await signIn(app, phone(1)));
    expect(errorCode(await get(app, '/auth/sessions', pending))).toBe('mfa_challenge_required');
  });

  it('enrolment gives an otpauth URI and manual key without the phone, and stores no plain secret', async () => {
    const cookie = await ownerCookie(2);
    const start = await post(app, '/auth/mfa/enrol/start', undefined, cookie);
    const { otpauthUri, manualKey } = start.json<{ otpauthUri: string; manualKey: string }>();
    expect(manualKey).toMatch(/^[A-Z2-7]{32}$/);
    const uri = new URL(otpauthUri);
    expect(uri.protocol).toBe('otpauth:');
    expect(uri.searchParams.get('secret')).toBe(manualKey);
    expect(uri.searchParams.get('issuer')).toBe('Shifa');
    expect(otpauthUri).not.toContain(phone(2).replace(/\D/g, '').slice(-9));
    const rows = await superuserDb(workerDatabaseName()).select().from(twoFactor);
    expect(JSON.stringify(rows)).not.toContain(manualKey);
  });

  it('confirming gives 10 distinct recovery codes, rotates the session and clears the gate', async () => {
    const cookie = await ownerCookie(3);
    const enrolled = await enrolTotp(app, cookie, clock);
    expect(new Set(enrolled.recoveryCodes).size).toBe(10);
    expect(enrolled.cookie).not.toBe(cookie);
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(401);
    expect((await get(app, '/auth/sessions', enrolled.cookie)).statusCode).toBe(200);
    expect((await get(app, '/auth/session', enrolled.cookie)).json()).toMatchObject({
      mfa: 'verified',
    });
    expect((await post(app, '/auth/mfa/enrol/start', undefined, enrolled.cookie)).statusCode).toBe(
      409,
    );
    expect((await platformAuditRows()).map((r) => r.event)).toContain('auth.mfa_enrolled');
  });

  it('at enrolment a code within ±1 step passes; beyond it, within ±10, gives the clock hint', async () => {
    const cookie = await ownerCookie(4);
    const start = await post(app, '/auth/mfa/enrol/start', undefined, cookie);
    const { manualKey } = start.json<{ manualKey: string }>();
    const confirm = (code: string) => post(app, '/auth/mfa/enrol/confirm', { code }, cookie);
    const skewed = await confirm(totpAt(manualKey, clock.now(), 5));
    expect(skewed.statusCode).toBe(400);
    expect(errorCode(skewed)).toBe('clock_skew');
    expect(errorCode(await confirm(totpAt(manualKey, clock.now(), 20)))).toBe('invalid_code');
    expect((await confirm(totpAt(manualKey, clock.now(), -1))).statusCode).toBe(200);
  });
});

describe('challenge (criterion 12)', () => {
  it('a pending session reaches nothing but the challenge; a code passes it and rotates the session', async () => {
    const owner = await enrolledOwner(5);
    expect((await get(app, '/auth/session', owner.pending)).json()).toMatchObject({
      mfa: 'pending',
    });
    expect(errorCode(await get(app, '/auth/sessions', owner.pending))).toBe(
      'mfa_challenge_required',
    );
    const res = await challenge(owner.pending, 'totp', totpAt(owner.manualKey, clock.now(), 1));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mfa: 'verified' });
    const rotated = sessionCookie(res);
    expect(rotated).not.toBe(owner.pending);
    expect((await get(app, '/auth/session', owner.pending)).statusCode).toBe(401);
    expect((await get(app, '/auth/sessions', rotated)).statusCode).toBe(200);
  });

  it('accepts ±1 step only, and never the same code twice', async () => {
    const owner = await enrolledOwner(6);
    expect(
      errorCode(await challenge(owner.pending, 'totp', totpAt(owner.manualKey, clock.now(), 2))),
    ).toBe('invalid_code');
    // No clock hint outside enrolment.
    expect(
      errorCode(await challenge(owner.pending, 'totp', totpAt(owner.manualKey, clock.now(), 5))),
    ).toBe('invalid_code');
    const code = totpAt(owner.manualKey, clock.now(), -1);
    expect((await challenge(owner.pending, 'totp', code)).statusCode).toBe(200);
    const again = sessionCookie(await signIn(app, phone(6)));
    expect(errorCode(await challenge(again, 'totp', code))).toBe('invalid_code');
    // An earlier step than the last one accepted is refused too.
    expect(
      errorCode(await challenge(again, 'totp', totpAt(owner.manualKey, clock.now(), -2))),
    ).toBe('invalid_code');
  });

  it('five wrong codes lock MFA for 15 min, even for the right code', async () => {
    const owner = await enrolledOwner(7);
    for (let i = 0; i < 4; i += 1) {
      expect(errorCode(await challenge(owner.pending, 'totp', '000000'))).toBe('invalid_code');
    }
    const fifth = await challenge(owner.pending, 'totp', '000000');
    expect(fifth.statusCode).toBe(429);
    expect(errorCode(fifth)).toBe('mfa_locked');
    const until = fifth.json<{ error: { until: string } }>().error.until;
    expect(new Date(until).getTime()).toBe(clock.now().getTime() + 15 * MINUTE);
    const right = await challenge(owner.pending, 'totp', totpAt(owner.manualKey, clock.now()));
    expect(errorCode(right)).toBe('mfa_locked');
    expect((await platformAuditRows()).map((r) => r.event)).toContain('auth.mfa_locked');
    clock.advanceBy(15 * MINUTE);
    const pending = sessionCookie(await signIn(app, phone(7)));
    expect(
      (await challenge(pending, 'totp', totpAt(owner.manualKey, clock.now()))).statusCode,
    ).toBe(200);
  });

  it('a recovery code passes once and is then gone', async () => {
    const owner = await enrolledOwner(8);
    const recovery = owner.recoveryCodes[0] ?? '';
    const res = await challenge(owner.pending, 'recovery', recovery);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mfa: 'verified' });
    const again = sessionCookie(await signIn(app, phone(8)));
    expect(errorCode(await challenge(again, 'recovery', recovery))).toBe('invalid_code');
    expect((await challenge(again, 'recovery', owner.recoveryCodes[1] ?? '')).statusCode).toBe(200);
    const events = (await platformAuditRows()).map((r) => r.event);
    expect(events.filter((e) => e === 'auth.recovery_code_used')).toHaveLength(2);
  });

  it('the challenge needs a pending session: a verified one gets 409', async () => {
    const owner = await enrolledOwner(9);
    const verified = sessionCookie(
      await challenge(owner.pending, 'totp', totpAt(owner.manualKey, clock.now())),
    );
    expect((await challenge(verified, 'totp', '123456')).statusCode).toBe(409);
  });
});
