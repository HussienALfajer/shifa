// A-02 criterion 16 (A-02-07; contract rows `A02cAnnouncements` and `dismissed`): every member of a
// targeted clinic sees the active announcements in clinic web (all clinics, or the selected ones),
// warnings first then newest, never a scheduled or ended one, until they dismiss each. A dismissal
// is the person's, across their sessions and clinics, and holds for the version they hid: an
// edited announcement shows again. A support session reads the banner but cannot dismiss it
// (403 `support_read_only`, as every write).
import { randomUUID } from 'node:crypto';
import { MyAnnouncements } from '@shifa/contracts';
import { membership, roleAssignment } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, sessionCookie, signIn, testClock } from '../identity/support.ts';
import type { SignedInAdmin } from '../platform/support.ts';
import { exchange, handoffToken, opened, supportCookie } from '../support-access/support.ts';
import {
  activeMember,
  type Clinic,
  errorCode,
  get,
  patch,
  post,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';

const clock = testClock();
const HOUR = 3_600_000;
let world: TeamWorld;
let first: Clinic;
let second: Clinic;
let doctor: { cookie: string; membershipId: string; phone: string; userId: string };

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_08);
  first = await world.clinic();
  second = await world.clinic();
  doctor = await activeMember(world, first, [{ role: 'doctor', branchId: null }]);
});

afterAll(async () => {
  await world.app.app.close();
});

const iso = (offsetMs: number) => new Date(clock.now().getTime() + offsetMs).toISOString();

async function announce(body: Record<string, unknown>): Promise<{ id: string; version: number }> {
  const res = await post(world.app, '/platform/announcements', body, world.admin.cookie);
  expect(res.statusCode, res.body).toBe(201);
  return res.json<{ id: string; version: number }>();
}
async function mine(cookie: string) {
  const res = await get(world.app, '/me/announcements', cookie);
  expect(res.statusCode, res.body).toBe(200);
  return MyAnnouncements.parse(res.json()).announcements;
}
const dismiss = (cookie: string, id: string, version: number) =>
  post(world.app, `/me/announcements/${id}/dismiss`, { version }, cookie);

let allInfo: { id: string; version: number };
let allWarning: { id: string; version: number };
let firstOnly: { id: string; version: number };

describe('what a member sees (row `A02cAnnouncements`)', () => {
  it('sees nothing before any announcement', async () => {
    expect(await mine(doctor.cookie)).toEqual([]);
  });

  it('sees active ones for every clinic or for theirs, warnings first, then newest', async () => {
    allInfo = await announce({
      body: 'أول إعلان للجميع',
      level: 'info',
      startsAt: iso(-3 * 60_000),
      target: 'all',
    });
    allWarning = await announce({
      body: 'تنبيه صيانة',
      level: 'warning',
      startsAt: iso(-2 * 60_000),
      endsAt: iso(HOUR),
      target: 'all',
    });
    firstOnly = await announce({
      body: 'لعيادتكم فقط',
      level: 'info',
      startsAt: iso(-60_000),
      target: 'selected',
      clinicIds: [first.clinicId],
    });
    await announce({ body: 'لاحقًا', level: 'warning', startsAt: iso(HOUR), target: 'all' });
    const ended = await announce({
      body: 'سينتهي',
      level: 'warning',
      startsAt: iso(-60_000),
      target: 'all',
    });
    const end = await post(
      world.app,
      `/platform/announcements/${ended.id}/end`,
      undefined,
      world.admin.cookie,
    );
    expect(end.statusCode).toBe(200);

    const seen = await mine(doctor.cookie);
    expect(seen.map((a) => a.id)).toEqual([allWarning.id, firstOnly.id, allInfo.id]);
    expect(seen[0]).toEqual({
      id: allWarning.id,
      version: 1,
      level: 'warning',
      body: 'تنبيه صيانة',
      startsAt: expect.any(String) as string,
      endsAt: expect.any(String) as string,
    });
    // The other clinic does not see the one selected for the first.
    expect((await mine(second.owner.cookie)).map((a) => a.id)).toEqual([allWarning.id, allInfo.id]);
  });
});

describe('dismissal (row `dismissed`)', () => {
  it('hides it for the person on every session, not for others', async () => {
    const other = sessionCookie(await signIn(world.app, doctor.phone, PASSWORD));
    const res = await dismiss(doctor.cookie, allWarning.id, 1);
    expect(res.statusCode, res.body).toBe(204);
    expect((await mine(doctor.cookie)).map((a) => a.id)).not.toContain(allWarning.id);
    expect((await mine(other)).map((a) => a.id)).not.toContain(allWarning.id);
    expect((await mine(first.owner.cookie)).map((a) => a.id)).toContain(allWarning.id);
    // Dismissing again is harmless.
    expect((await dismiss(other, allWarning.id, 1)).statusCode).toBe(204);
  });

  it('keeps the dismissal across the person’s clinics', async () => {
    // The doctor also becomes a member of the second clinic and switches to it.
    const su = superuserDb(workerDatabaseName());
    const membershipId = randomUUID();
    await su.insert(membership).values({
      id: membershipId,
      tenantId: second.clinicId,
      userId: doctor.userId,
      phoneE164: doctor.phone,
      displayName: 'طبيب تجريبي',
      status: 'active',
    });
    await su
      .insert(roleAssignment)
      .values({ tenantId: second.clinicId, membershipId, role: 'doctor', branchId: null });
    const switched = await post(
      world.app,
      '/me/switch',
      { tenantId: second.clinicId, branchId: second.branchId },
      doctor.cookie,
    );
    expect(switched.statusCode, switched.body).toBe(200);
    const seen = (await mine(doctor.cookie)).map((a) => a.id);
    expect(seen).toEqual([allInfo.id]);
    const back = await post(
      world.app,
      '/me/switch',
      { tenantId: first.clinicId, branchId: first.branchId },
      doctor.cookie,
    );
    expect(back.statusCode, back.body).toBe(200);
  });

  it('shows an edited announcement again (a new version)', async () => {
    const edited = await patch(
      world.app,
      `/platform/announcements/${allWarning.id}`,
      { body: 'تنبيه صيانة: تغيّر الموعد' },
      world.admin.cookie,
    );
    expect(edited.statusCode, edited.body).toBe(200);
    const again = (await mine(doctor.cookie)).find((a) => a.id === allWarning.id);
    expect(again).toMatchObject({ version: 2, body: 'تنبيه صيانة: تغيّر الموعد' });
    // Dismissing the old version does not hide the new one.
    expect((await dismiss(doctor.cookie, allWarning.id, 1)).statusCode).toBe(204);
    expect((await mine(doctor.cookie)).map((a) => a.id)).toContain(allWarning.id);
    expect((await dismiss(doctor.cookie, allWarning.id, 2)).statusCode).toBe(204);
    expect((await mine(doctor.cookie)).map((a) => a.id)).not.toContain(allWarning.id);
  });

  it('answers 404 for one not shown to the person (ended, other clinic, later version, unknown)', async () => {
    const forFirst = await announce({
      body: 'للأولى فقط',
      level: 'info',
      startsAt: iso(-60_000),
      target: 'selected',
      clinicIds: [first.clinicId],
    });
    const cases: [string, string, number][] = [
      [second.owner.cookie, forFirst.id, 1],
      [doctor.cookie, forFirst.id, 2],
      [doctor.cookie, '00000000-0000-4000-8000-00000000cafe', 1],
    ];
    await post(
      world.app,
      `/platform/announcements/${firstOnly.id}/end`,
      undefined,
      world.admin.cookie,
    );
    cases.push([doctor.cookie, firstOnly.id, 1]);
    for (const [cookie, id, version] of cases) {
      const res = await dismiss(cookie, id, version);
      expect(res.statusCode, `${id} v${String(version)}`).toBe(404);
      expect(errorCode(res)).toBe('not_found');
    }
  });

  it('refuses a version below 1 (400)', async () => {
    const res = await dismiss(doctor.cookie, allInfo.id, 0);
    expect(res.statusCode).toBe(400);
  });
});

describe('a support session', () => {
  it('reads the banner and cannot dismiss it (403 support_read_only)', async () => {
    const supportWorldView = {
      app: world.app,
      clock,
      admin: world.admin as SignedInAdmin,
      clinicId: second.clinicId,
      owner: second.owner.cookie,
    };
    const grant = await opened(supportWorldView);
    const tab = supportCookie(await exchange(supportWorldView, handoffToken(grant.handoffUrl)));
    const seen = await mine(tab);
    expect(seen.map((a) => a.id)).toContain(allInfo.id);
    const res = await dismiss(tab, allInfo.id, 1);
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('support_read_only');
  });

  it('a super admin’s own session (no clinic) is refused', async () => {
    const res = await get(world.app, '/me/announcements', world.admin.cookie);
    expect(res.statusCode).toBe(403);
  });
});

// Last: the clock moves five minutes ahead, which the support policies (bounded by the database's
// clock) would refuse.
describe('time (row `A02cAnnouncements`)', () => {
  it('shows a scheduled one once it starts, and drops one when its end passes', async () => {
    const soon = await announce({
      body: 'بعد قليل',
      level: 'info',
      startsAt: iso(4 * 60_000),
      target: 'all',
    });
    const short = await announce({
      body: 'ينتهي قريبًا',
      level: 'info',
      startsAt: iso(-60_000),
      endsAt: iso(4 * 60_000),
      target: 'all',
    });
    let seen = (await mine(doctor.cookie)).map((a) => a.id);
    expect(seen).toContain(short.id);
    expect(seen).not.toContain(soon.id);
    clock.advanceBy(5 * 60_000);
    seen = (await mine(doctor.cookie)).map((a) => a.id);
    expect(seen).toContain(soon.id);
    expect(seen).not.toContain(short.id);
    // Out of the way of the tests below.
    const end = await post(
      world.app,
      `/platform/announcements/${soon.id}/end`,
      undefined,
      world.admin.cookie,
    );
    expect(end.statusCode).toBe(200);
  });
});
