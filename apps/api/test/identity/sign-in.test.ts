// A-01a criteria 6 and 7: phone + password sign-in; one answer and comparable timing whether or
// not the phone exists; 5 failures per phone and 30 per IP in 15 min lock for 15 min (429 with
// the lock's end). Synthetic phones only.
import { syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../support.ts';
import {
  get,
  identityApp,
  PASSWORD,
  resetWithTenants,
  seedPerson,
  sessionCookie,
  signIn,
  testClock,
} from './support.ts';

const MINUTE = 60_000;
const phones = syntheticPhones(2026_11_02, 40);
const phone = (i: number) => phones[i] ?? '';

let app: TestApp;
let clock: FixedClock;

beforeEach(async () => {
  await resetWithTenants();
  clock = testClock();
  app = await identityApp(clock);
});

afterEach(async () => {
  await app.app.close();
});

const INVALID = { error: { code: 'invalid_credentials', message: expect.any(String) as unknown } };

describe('sign-in (criterion 6)', () => {
  it('signs in with phone and password and answers the session', async () => {
    const person = await seedPerson(phone(0));
    const res = await signIn(app, phone(0));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ userId: person.userId, tenantId: null });
    expect((await get(app, '/auth/session', sessionCookie(res))).statusCode).toBe(200);
  });

  it('accepts the phone in any accepted spelling (local, Arabic-Indic digits, spaces)', async () => {
    await seedPerson('+963944123456');
    for (const typed of ['0944 123 456', '٠٩٤٤١٢٣٤٥٦', '00963944123456']) {
      expect((await signIn(app, typed)).statusCode, typed).toBe(200);
    }
  });

  it('answers 400 validation_failed for a phone that is not a phone, naming the field only', async () => {
    const res = await signIn(app, 'not a phone');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({
      error: {
        code: 'validation_failed',
        message: expect.any(String) as unknown,
        details: [{ path: 'body.phone', code: 'invalid_format' }],
      },
    });
  });

  it('a wrong password and an unknown phone get the same status and body', async () => {
    await seedPerson(phone(1));
    const wrong = await signIn(app, phone(1), 'not the password at all');
    const unknown = await signIn(app, phone(2), 'not the password at all');
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(INVALID);
    expect(unknown.body).toBe(wrong.body);
    expect(Object.keys(unknown.headers).sort()).toEqual(Object.keys(wrong.headers).sort());
  });

  it('an unknown phone takes comparable time to a wrong password (password hash either way)', async () => {
    for (const i of [3, 30, 31]) await seedPerson(phone(i));
    const time = async (p: string) => {
      const start = performance.now();
      await signIn(app, p, 'not the password at all', { ip: '198.51.100.7' });
      return performance.now() - start;
    };
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[2] ?? 0;
    const known: number[] = [];
    const unknown: number[] = [];
    // Alternate so warm-up and noise hit both; 3 each per phone stays under the lock of 5.
    for (let i = 0; i < 3; i += 1) {
      known.push(await time(phone(3)));
      unknown.push(await time(phone(4 + i)));
    }
    for (let i = 0; i < 2; i += 1) {
      known.push(await time(phone(30 + i)));
      unknown.push(await time(phone(32 + i)));
    }
    const ratio = median(unknown) / median(known);
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
    // Both paths verified a scrypt hash: neither answers instantly.
    expect(Math.min(median(known), median(unknown))).toBeGreaterThan(5);
  });
});

describe('lockouts (criterion 7)', () => {
  it('five failures for one phone lock it for 15 minutes with 429 phone_locked and until', async () => {
    await seedPerson(phone(10));
    for (let i = 1; i <= 4; i += 1) {
      expect((await signIn(app, phone(10), 'wrong password nr ' + String(i))).statusCode).toBe(401);
    }
    const locking = await signIn(app, phone(10), 'wrong password nr 5');
    expect(locking.statusCode).toBe(429);
    const until = new Date(clock.now().getTime() + 15 * MINUTE).toISOString();
    expect(locking.json()).toEqual({
      error: { code: 'phone_locked', message: expect.any(String) as unknown, until },
    });
    // The right password does not help while locked, and the lock does not move.
    clock.advanceBy(14 * MINUTE);
    const still = await signIn(app, phone(10), PASSWORD);
    expect(still.statusCode).toBe(429);
    expect((still.json() as { error: { until: string } }).error.until).toBe(until);
    clock.advanceBy(MINUTE);
    expect((await signIn(app, phone(10), PASSWORD)).statusCode).toBe(200);
  });

  it('an unknown phone locks the same way (no enumeration through the lock)', async () => {
    for (let i = 1; i <= 4; i += 1) {
      expect((await signIn(app, phone(11), 'wrong password')).statusCode).toBe(401);
    }
    const res = await signIn(app, phone(11), 'wrong password');
    expect(res.statusCode).toBe(429);
    expect((res.json() as { error: { code: string } }).error.code).toBe('phone_locked');
  });

  it('failures spread over more than 15 minutes do not lock', async () => {
    await seedPerson(phone(12));
    for (let i = 0; i < 4; i += 1) await signIn(app, phone(12), 'wrong password');
    clock.advanceBy(15 * MINUTE);
    for (let i = 0; i < 4; i += 1) {
      expect((await signIn(app, phone(12), 'wrong password')).statusCode).toBe(401);
    }
  });

  it('30 failures from one IP block it for 15 minutes with 429 ip_blocked; other IPs pass', async () => {
    await seedPerson(phone(39));
    const ip = '192.0.2.44';
    for (let i = 0; i < 29; i += 1) {
      const res = await signIn(app, phone(i % 29), 'wrong password', { ip });
      expect(res.statusCode, `attempt ${String(i + 1)}`).toBe(401);
    }
    const blocking = await signIn(app, phone(29), 'wrong password', { ip });
    expect(blocking.statusCode).toBe(429);
    const until = new Date(clock.now().getTime() + 15 * MINUTE).toISOString();
    expect(blocking.json()).toEqual({
      error: { code: 'ip_blocked', message: expect.any(String) as unknown, until },
    });
    expect((await signIn(app, phone(39), PASSWORD, { ip })).statusCode).toBe(429);
    expect((await signIn(app, phone(39), PASSWORD, { ip: '192.0.2.45' })).statusCode).toBe(200);
    clock.advanceBy(15 * MINUTE);
    expect((await signIn(app, phone(39), PASSWORD, { ip })).statusCode).toBe(200);
  });

  it('a success resets the phone counter', async () => {
    await seedPerson(phone(13));
    for (let i = 0; i < 4; i += 1) await signIn(app, phone(13), 'wrong password');
    expect((await signIn(app, phone(13), PASSWORD)).statusCode).toBe(200);
    for (let i = 0; i < 4; i += 1) {
      expect((await signIn(app, phone(13), 'wrong password')).statusCode).toBe(401);
    }
  });
});
