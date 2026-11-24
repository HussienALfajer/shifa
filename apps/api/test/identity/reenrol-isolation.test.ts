// A-01-11 checkpoint 5: one person's TOTP re-enrolment (OD-98) works on their own two_factor row
// only; another person's secret, replay state and recovery codes are untouched.
import { twoFactor } from '@shifa/db';
import { fixtureId, superuserDb, syntheticPhones, workerDatabaseName } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enrolTotp, platformApp, post } from '../platform/support.ts';
import type { TestApp } from '../support.ts';
import { resetWithTenants, seedPerson, sessionCookie, signIn, testClock } from './support.ts';
import { STEP_MS, totpAt } from './totp.ts';

const TENANT = fixtureId('reenrol-isolation:tenant');
const [A = '', B = ''] = syntheticPhones(2026_11_30, 2);

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

async function enrolled(phone: string) {
  const person = await seedPerson(phone, { tenantId: TENANT, role: 'doctor' });
  const done = await enrolTotp(app, sessionCookie(await signIn(app, phone)), clock);
  return { ...done, userId: person.userId };
}

const rowOf = async (userId: string) =>
  (
    await superuserDb(workerDatabaseName())
      .select()
      .from(twoFactor)
      .where(eq(twoFactor.userId, userId))
  )[0];

describe('re-enrolment isolation', () => {
  it('A’s re-enrolment leaves B’s row as it was', async () => {
    const a = await enrolled(A);
    const b = await enrolled(B);
    clock.advanceBy(2 * STEP_MS);
    const bBefore = await rowOf(b.userId);
    const aBefore = await rowOf(a.userId);

    const start = await post(
      app,
      '/auth/mfa/re-enrol/start',
      { code: totpAt(a.manualKey, clock.now()) },
      a.cookie,
    );
    expect(start.statusCode).toBe(200);
    expect(await rowOf(b.userId)).toEqual(bBefore);
    const key = start.json<{ manualKey: string }>().manualKey;
    const confirm = await post(
      app,
      '/auth/mfa/re-enrol/confirm',
      { code: totpAt(key, clock.now()) },
      a.cookie,
    );
    expect(confirm.statusCode).toBe(200);

    expect(await rowOf(b.userId)).toEqual(bBefore);
    expect((await rowOf(a.userId))?.secret).not.toBe(aBefore?.secret);
    clock.advanceBy(STEP_MS);
    const pending = sessionCookie(await signIn(app, B));
    const passed = await post(
      app,
      '/auth/mfa/challenge',
      { method: 'totp', code: totpAt(b.manualKey, clock.now()) },
      pending,
    );
    expect(passed.statusCode).toBe(200);
  });
});
