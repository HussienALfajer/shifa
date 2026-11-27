// A-02-07 review findings, proven through the API: the banner's "newest" is by start, not by
// creation (reviewer 8); a scheduled announcement cannot be dismissed (8); a clinic removed from a
// selected announcement stops seeing it (8); a cancelled announcement never reaches a clinic
// (security N1); a switch out of a suspended clinic is not a new sign-in (reviewer 2).
import { randomUUID } from 'node:crypto';
import { ClinicUsage, MyAnnouncements } from '@shifa/contracts';
import { membership, roleAssignment } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, sessionCookie, signIn, testClock } from '../identity/support.ts';
import {
  activeMember,
  type Clinic,
  get,
  patch,
  post,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';

const clock = testClock();
const MINUTE = 60_000;
let world: TeamWorld;
let first: Clinic;
let second: Clinic;
let doctor: { cookie: string; membershipId: string; phone: string; userId: string };

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_12);
  first = await world.clinic();
  second = await world.clinic();
  doctor = await activeMember(world, first, [{ role: 'doctor', branchId: null }]);
});

afterAll(async () => {
  await world.app.app.close();
});

const iso = (offsetMs: number) => new Date(clock.now().getTime() + offsetMs).toISOString();
async function announce(body: Record<string, unknown>): Promise<string> {
  const res = await post(world.app, '/platform/announcements', body, world.admin.cookie);
  expect(res.statusCode, res.body).toBe(201);
  return res.json<{ id: string }>().id;
}
async function mine(cookie: string): Promise<string[]> {
  const res = await get(world.app, '/me/announcements', cookie);
  expect(res.statusCode, res.body).toBe(200);
  return MyAnnouncements.parse(res.json()).announcements.map((a) => a.id);
}
async function signInsOf(clinicId: string): Promise<number> {
  const res = await get(world.app, `/platform/clinics/${clinicId}/usage`, world.admin.cookie);
  expect(res.statusCode, res.body).toBe(200);
  return ClinicUsage.parse(res.json()).todayCounts.signIns;
}

describe('the banner', () => {
  it('shows the latest start first, whatever the order of creation', async () => {
    const startsLater = await announce({
      body: 'بدأ بعد الآخر',
      level: 'info',
      startsAt: iso(-MINUTE),
      target: 'all',
    });
    const startsEarlier = await announce({
      body: 'بدأ قبل الآخر',
      level: 'info',
      startsAt: iso(-10 * MINUTE),
      target: 'all',
    });
    expect(await mine(doctor.cookie)).toEqual([startsLater, startsEarlier]);
    for (const id of [startsLater, startsEarlier]) {
      await post(world.app, `/platform/announcements/${id}/end`, undefined, world.admin.cookie);
    }
  });

  it('cannot dismiss a scheduled announcement (404)', async () => {
    const later = await announce({
      body: 'لاحقًا',
      level: 'info',
      startsAt: iso(60 * MINUTE),
      target: 'all',
    });
    const res = await post(
      world.app,
      `/me/announcements/${later}/dismiss`,
      { version: 1 },
      doctor.cookie,
    );
    expect(res.statusCode).toBe(404);
  });

  it('drops an announcement for a clinic removed from its selection', async () => {
    const id = await announce({
      body: 'للعيادتين',
      level: 'warning',
      startsAt: iso(-MINUTE),
      target: 'selected',
      clinicIds: [first.clinicId, second.clinicId],
    });
    expect(await mine(second.owner.cookie)).toContain(id);
    const res = await patch(
      world.app,
      `/platform/announcements/${id}`,
      { clinicIds: [first.clinicId] },
      world.admin.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(await mine(second.owner.cookie)).not.toContain(id);
    expect(await mine(doctor.cookie)).toContain(id);
    await post(world.app, `/platform/announcements/${id}/end`, undefined, world.admin.cookie);
  });

  it('never shows a cancelled announcement, even once its start has passed', async () => {
    const id = await announce({
      body: 'أُلغي',
      level: 'info',
      startsAt: iso(2 * MINUTE),
      target: 'all',
    });
    await post(world.app, `/platform/announcements/${id}/end`, undefined, world.admin.cookie);
    clock.advanceBy(3 * MINUTE);
    expect(await mine(doctor.cookie)).not.toContain(id);
  });
});

describe('sign-ins and a suspended clinic (reviewer 2)', () => {
  it('a switch out of a suspended clinic is no new sign-in', async () => {
    // The doctor also works in the second clinic: a new sign-in finds two clinics (the chooser).
    const id = randomUUID();
    const su = superuserDb(workerDatabaseName());
    await su.insert(membership).values({
      id,
      tenantId: second.clinicId,
      userId: doctor.userId,
      phoneE164: doctor.phone,
      displayName: 'طبيب تجريبي',
      status: 'active',
    });
    await su
      .insert(roleAssignment)
      .values({ tenantId: second.clinicId, membershipId: id, role: 'doctor', branchId: null });
    const cookie = sessionCookie(await signIn(world.app, doctor.phone, PASSWORD));
    const firstBefore = await signInsOf(first.clinicId);
    const toFirst = await post(world.app, '/me/switch', { tenantId: first.clinicId }, cookie);
    expect(toFirst.statusCode, toFirst.body).toBe(200);
    // The first choice of a session without a clinic is its sign-in.
    expect(await signInsOf(first.clinicId)).toBe(firstBefore + 1);

    const suspended = await patch(
      world.app,
      `/platform/clinics/${first.clinicId}`,
      { status: 'suspended' },
      world.admin.cookie,
    );
    expect(suspended.statusCode, suspended.body).toBe(200);
    const secondBefore = await signInsOf(second.clinicId);
    const toSecond = await post(world.app, '/me/switch', { tenantId: second.clinicId }, cookie);
    expect(toSecond.statusCode, toSecond.body).toBe(200);
    expect(await signInsOf(second.clinicId)).toBe(secondBefore);
  });
});
