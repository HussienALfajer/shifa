// A-01a criterion 9 (A-01-09): why a session ended travels with 401 `session_expired`: `idle`,
// `absolute`, or `ended` (on another device, by the owner, by the super admin; a change of
// password is in account.test.ts). A missing or forged cookie stays 401 `unauthorized` with no
// reason.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activeMember,
  type Clinic,
  get,
  post,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';
import { PASSWORD, sessionCookie, signIn, testClock } from './support.ts';

const MINUTE = 60_000;
const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_11_27);
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

const errorOf = async (cookie?: string) => {
  const res = await get(world.app, '/auth/session', cookie);
  expect(res.statusCode).toBe(401);
  return res.json<{ error: { code: string; reason?: string } }>().error;
};

describe('reason of an ended session (criterion 9)', () => {
  it('ended on another device → ended', async () => {
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const second = sessionCookie(await signIn(world.app, m.phone, PASSWORD));
    expect((await post(world.app, '/auth/sessions/end-others', undefined, second)).statusCode).toBe(
      200,
    );
    expect(await errorOf(m.cookie)).toMatchObject({ code: 'session_expired', reason: 'ended' });
  });

  it('ended by the owner (deactivation) → ended', async () => {
    const m = await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]);
    const off = await post(
      world.app,
      `/team/members/${m.membershipId}/deactivate`,
      {},
      clinic.owner.cookie,
    );
    expect(off.statusCode).toBe(200);
    expect(await errorOf(m.cookie)).toMatchObject({ code: 'session_expired', reason: 'ended' });
  });

  it('ended by the super admin → ended', async () => {
    const other = await world.clinic();
    const res = await post(
      world.app,
      `/platform/clinics/${other.clinicId}/owner/end-sessions`,
      {},
      world.admin.cookie,
    );
    expect(res.statusCode, res.body).toBe(204);
    expect(await errorOf(other.owner.cookie)).toMatchObject({
      code: 'session_expired',
      reason: 'ended',
    });
  });

  it('a missing or forged cookie → unauthorized, no reason', async () => {
    const missing = await errorOf();
    expect(missing).toMatchObject({ code: 'unauthorized' });
    expect(missing.reason).toBeUndefined();
    const forged = await errorOf('__Host-shifa.sid=abc.AAAA');
    expect(forged.code).toBe('unauthorized');
    expect(forged.reason).toBeUndefined();
  });

  it('past the idle limit → idle', async () => {
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    clock.advanceBy(31 * MINUTE);
    expect(await errorOf(m.cookie)).toMatchObject({ code: 'session_expired', reason: 'idle' });
  });

  it('past the absolute limit → absolute', async () => {
    // The idle test above ran every earlier session out: a fresh world, clinic and member.
    await world.app.app.close();
    world = await teamWorld(clock, 2026_11_28);
    const fresh = await world.clinic();
    const m = await activeMember(world, fresh, [{ role: 'doctor', branchId: null }]);
    // Active every 20 minutes for 12 hours: never idle, but past 12 h.
    for (let i = 0; i < 35; i += 1) {
      clock.advanceBy(20 * MINUTE);
      expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(200);
    }
    clock.advanceBy(21 * MINUTE);
    const res = await get(world.app, '/auth/session', m.cookie);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: { code: 'session_expired', reason: 'absolute' } });
  });
});
