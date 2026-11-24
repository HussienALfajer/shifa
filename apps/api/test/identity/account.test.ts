// A-01a criteria 10a and 10b (A-01-09, OD-92): the signed-in person's own profile (before MFA
// too; the phone to its owner only) and the change of their own password: the current password
// checked and counted toward the phone lock, the rules of criterion 8 and `password_unchanged`,
// every other session ended and this one rotated, audited.
import { fixtureId, syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enrolTotp, errorCode, platformApp, post } from '../platform/support.ts';
import type { TestApp } from '../support.ts';
import {
  auditRows,
  get,
  PASSWORD,
  resetWithTenants,
  seedPerson,
  sessionCookie,
  signIn,
  testClock,
} from './support.ts';

const MINUTE = 60_000;
const TENANT = fixtureId('account:tenant');
const phones = syntheticPhones(2026_11_25, 12);
const phone = (i: number) => phones[i] ?? '';
const NEW_PASSWORD = 'amber window crane 77';

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

const changePassword = (cookie: string, currentPassword: string, newPassword: string) =>
  post(app, '/auth/password', { currentPassword, newPassword }, cookie);

describe('own profile (criterion 10a)', () => {
  it('answers the signed-in person’s id, name and phone', async () => {
    const person = await seedPerson(phone(0), { tenantId: TENANT, role: 'doctor' });
    const cookie = sessionCookie(await signIn(app, phone(0)));
    const res = await get(app, '/me', cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ userId: person.userId, name: 'شخص تجريبي', phoneE164: phone(0) });
  });

  it('is reachable before the second factor (the challenge greets by name)', async () => {
    await seedPerson(phone(1), { tenantId: TENANT, role: 'owner' });
    const cookie = sessionCookie(await signIn(app, phone(1)));
    // An owner without TOTP: everything but enrolment is blocked, the profile is not.
    expect((await get(app, '/auth/sessions', cookie)).statusCode).toBe(403);
    expect((await get(app, '/me', cookie)).statusCode).toBe(200);
  });

  it('is the caller’s own: another person’s session reads its own profile only', async () => {
    const first = await seedPerson(phone(2));
    const second = await seedPerson(phone(3));
    const cookie = sessionCookie(await signIn(app, phone(3)));
    const body = (await get(app, '/me', cookie)).json<{ userId: string; phoneE164: string }>();
    expect(body.userId).toBe(second.userId);
    expect(JSON.stringify(body)).not.toContain(first.userId);
    expect(JSON.stringify(body)).not.toContain(phone(2));
  });

  it('anonymous → 401', async () => {
    expect((await get(app, '/me')).statusCode).toBe(401);
  });
});

describe('change of password (criterion 10b, OD-92)', () => {
  it('each rule of criterion 8 is named, and the same password again is `password_unchanged`', async () => {
    await seedPerson(phone(4));
    const cookie = sessionCookie(await signIn(app, phone(4)));
    const national = phone(4).replace(/\D/g, '').slice(3);
    const cases: [string, string][] = [
      ['short pw', 'password_too_short'],
      ['password1234', 'password_common'],
      [`my ${national} pass`, 'password_contains_phone'],
      [PASSWORD, 'password_unchanged'],
    ];
    for (const [candidate, code] of cases) {
      const res = await changePassword(cookie, PASSWORD, candidate);
      expect(res.statusCode, candidate).toBe(400);
      expect(errorCode(res)).toBe(code);
    }
    // A refused change leaves the session and the password as they were.
    expect((await get(app, '/auth/session', cookie)).statusCode).toBe(200);
    expect((await signIn(app, phone(4))).statusCode).toBe(200);
  });

  it('a wrong current password is 401, counted: the fifth locks the phone (429 with until), sign-in too', async () => {
    const person = await seedPerson(phone(5));
    const cookie = sessionCookie(await signIn(app, phone(5)));
    for (let i = 0; i < 4; i += 1) {
      const res = await changePassword(cookie, 'not the password 1', NEW_PASSWORD);
      expect(res.statusCode).toBe(401);
      expect(errorCode(res)).toBe('invalid_credentials');
    }
    const fifth = await changePassword(cookie, 'not the password 1', NEW_PASSWORD);
    expect(fifth.statusCode).toBe(429);
    expect(errorCode(fifth)).toBe('phone_locked');
    const until = fifth.json<{ error: { until: string } }>().error.until;
    expect(new Date(until).getTime()).toBe(clock.now().getTime() + 15 * MINUTE);
    // Locked: even the right current password and the sign-in are refused.
    expect(errorCode(await changePassword(cookie, PASSWORD, NEW_PASSWORD))).toBe('phone_locked');
    expect(errorCode(await signIn(app, phone(5)))).toBe('phone_locked');
    const events = (await auditRows()).filter((r) => r.targetId === person.userId);
    expect(events.filter((r) => r.event === 'auth.password_change_failed')).toHaveLength(5);
    expect(events.map((r) => r.event)).toContain('auth.locked');
  });

  it('success: other sessions end (session_expired, ended), this one rotates, old password refused', async () => {
    const person = await seedPerson(phone(6));
    const other = sessionCookie(await signIn(app, phone(6)));
    const cookie = sessionCookie(await signIn(app, phone(6)));
    const res = await changePassword(cookie, PASSWORD, NEW_PASSWORD);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ userId: person.userId, mfa: 'none' });
    const rotated = sessionCookie(res);
    expect(rotated).not.toBe(cookie);
    expect((await get(app, '/auth/session', rotated)).statusCode).toBe(200);
    for (const old of [cookie, other]) {
      const gone = await get(app, '/auth/session', old);
      expect(gone.statusCode).toBe(401);
      expect(gone.json()).toMatchObject({ error: { code: 'session_expired', reason: 'ended' } });
    }
    expect(errorCode(await signIn(app, phone(6)))).toBe('invalid_credentials');
    expect((await signIn(app, phone(6), NEW_PASSWORD)).statusCode).toBe(200);
    const rows = await auditRows();
    expect(rows.filter((r) => r.event === 'auth.password_changed')).toEqual([
      expect.objectContaining({ actorId: person.userId, targetId: person.userId }),
    ]);
    const ended = rows.filter(
      (r) =>
        r.event === 'auth.session_ended' &&
        (r.data as { reason?: string }).reason === 'password_changed',
    );
    expect(ended).toHaveLength(1);
    // Nothing of either password in any audit row.
    expect(JSON.stringify(rows)).not.toContain(NEW_PASSWORD);
    expect(JSON.stringify(rows)).not.toContain(PASSWORD);
  });

  it('keeps the second factor of the session: a verified session stays verified', async () => {
    await seedPerson(phone(7), { tenantId: TENANT, role: 'owner' });
    const enrolled = await enrolTotp(app, sessionCookie(await signIn(app, phone(7))), clock);
    const res = await changePassword(enrolled.cookie, PASSWORD, NEW_PASSWORD);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ mfa: 'verified' });
    expect((await get(app, '/auth/sessions', sessionCookie(res))).statusCode).toBe(200);
  });

  it('a pending session cannot change the password (after MFA only)', async () => {
    await seedPerson(phone(8), { tenantId: TENANT, role: 'doctor' });
    await enrolTotp(app, sessionCookie(await signIn(app, phone(8))), clock);
    clock.advanceBy(MINUTE);
    const pending = sessionCookie(await signIn(app, phone(8)));
    const res = await changePassword(pending, PASSWORD, NEW_PASSWORD);
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('mfa_challenge_required');
  });
});
