// A-01-02 review fixes: the session list hides sessions already dead from idle (N2), and a
// session replaced at sign-in names the person who signed in as the actor (N6).
import { fixtureId, syntheticPhones } from '@shifa/db/testing';
import type { FixedClock } from '@shifa/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestApp } from '../support.ts';
import {
  auditRows,
  get,
  identityApp,
  resetWithTenants,
  seedPerson,
  sessionCookie,
  setIdleMinutes,
  signIn,
  testClock,
} from './support.ts';

const MINUTE = 60_000;
const TENANT = fixtureId('sessions-review:tenant');
const phones = syntheticPhones(2026_11_22, 4);
const phone = (i: number) => phones[i] ?? '';

let app: TestApp;
let clock: FixedClock;

beforeEach(async () => {
  await resetWithTenants(TENANT);
  clock = testClock();
  app = await identityApp(clock);
});

afterEach(async () => {
  await app.app.close();
});

describe('session list and rotation', () => {
  it('lists only sessions that are still alive by their own clinic’s idle limit', async () => {
    await setIdleMinutes(TENANT, 15);
    await seedPerson(phone(0), { tenantId: TENANT, role: 'doctor' });
    const old = sessionCookie(await signIn(app, phone(0)));
    clock.advanceBy(10 * MINUTE);
    const fresh = sessionCookie(await signIn(app, phone(0)));
    clock.advanceBy(10 * MINUTE);
    // `old` has been idle 20 minutes (limit 15); `fresh` 10.
    const { sessions } = (await get(app, '/auth/sessions', fresh)).json<{
      sessions: { current: boolean }[];
    }>();
    expect(sessions).toEqual([expect.objectContaining({ current: true })]);
    expect((await get(app, '/auth/session', old)).statusCode).toBe(401);
  });

  it('a replaced session names the person who signed in as the actor', async () => {
    await seedPerson(phone(1));
    const someoneElse = await seedPerson(phone(2));
    const theirs = sessionCookie(await signIn(app, phone(1)));
    await signIn(app, phone(2), undefined, { cookie: theirs });
    const [replaced] = (await auditRows()).filter(
      (r) =>
        r.event === 'auth.session_ended' && (r.data as { reason?: string }).reason === 'replaced',
    );
    expect(replaced?.actorId).toBe(someoneElse.userId);
    expect((await get(app, '/auth/session', theirs)).statusCode).toBe(401);
  });
});
