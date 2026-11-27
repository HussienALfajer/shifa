// A-02 criteria 17, 19 and 21 (A-02-07; contract rows `use`, `useMembers`, `useLoading`,
// `useEmpty` and the clinics list with usage). Sign-ins through the API, and a setup link's first
// session (review N1), are counted in the sign-in's clinic (every sign-in, and each member once a
// day); the clinic page reads today's figures, the current members and branches, the last activity, 30 zero-filled Damascus days
// (oldest first, today last) and the totals of the 30 days before; the clinics list gains the
// last activity and the sign-ins of the last seven days. Audited (`clinic.usage_viewed`).
import { ClinicList, ClinicUsage } from '@shifa/contracts';
import { usageDaily } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { damascusDay } from '../../src/modules/usage/index.ts';
import { PASSWORD, signIn, testClock } from '../identity/support.ts';
import { createClinicViaApi } from '../platform/support.ts';
import {
  activeMember,
  addMember,
  auditRowsOf,
  type Clinic,
  get,
  post,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';

const clock = testClock();
const DAY_MS = 86_400_000;
let world: TeamWorld;
let clinic: Clinic;
let quiet: Clinic;
let doctor: { cookie: string; membershipId: string; phone: string; userId: string };

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_09);
  clinic = await world.clinic();
  quiet = await world.clinic();
  doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
});

afterAll(async () => {
  await world.app.app.close();
});

const today = () => damascusDay(clock.now());
const dayBefore = (n: number) => damascusDay(new Date(clock.now().getTime() - n * DAY_MS));
async function usage(id: string): Promise<ClinicUsage> {
  const res = await get(world.app, `/platform/clinics/${id}/usage`, world.admin.cookie);
  expect(res.statusCode, res.body).toBe(200);
  return ClinicUsage.parse(res.json());
}
async function summaries() {
  const res = await get(world.app, '/platform/clinics', world.admin.cookie);
  expect(res.statusCode, res.body).toBe(200);
  return ClinicList.parse(res.json()).clinics;
}
const seed = (tenantId: string, day: string, key: string, value: number) =>
  superuserDb(workerDatabaseName()).insert(usageDaily).values({ tenantId, day, key, value });
const rowsOf = (tenantId: string, day: string) =>
  superuserDb(workerDatabaseName())
    .select()
    .from(usageDaily)
    .where(and(eq(usageDaily.tenantId, tenantId), eq(usageDaily.day, day)));

describe('counted on sign-in (criterion 17)', () => {
  it('counts every sign-in in its clinic and each member once a day', async () => {
    for (const phone of [doctor.phone, doctor.phone, clinic.ownerPhone]) {
      const res = await signIn(world.app, phone, PASSWORD);
      expect(res.statusCode, res.body).toBe(200);
    }
    const view = await usage(clinic.clinicId);
    expect(view.today).toBe(today());
    expect(view.hasData).toBe(true);
    // Two setup links' first sessions (the owner's and the doctor's) and three sign-ins.
    expect(view.todayCounts).toEqual({
      signIns: 5,
      membersSignedIn: 2,
      activeMembers: 2,
      activeBranches: 1,
    });
    expect(view.lastActivityAt).not.toBeNull();
    // The other clinic counted only its owner's setup link.
    expect((await usage(quiet.clinicId)).todayCounts.signIns).toBe(1);
  });

  it('a failed sign-in counts nothing', async () => {
    const res = await signIn(world.app, doctor.phone, 'not the password at all');
    expect(res.statusCode).toBe(401);
    expect((await usage(clinic.clinicId)).todayCounts.signIns).toBe(5);
  });

  it('shows the current members (pending included) and branches beside today’s figures', async () => {
    const pending = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'receptionist', branchId: null }],
    });
    expect(pending.res.statusCode).toBe(201);
    const view = await usage(clinic.clinicId);
    expect(view.members).toBe(3);
    expect(view.branches).toBe(1);
    expect(view.todayCounts.activeMembers).toBe(2);
  });

  it('refreshes the day’s active members when a member changes', async () => {
    const off = await post(
      world.app,
      `/team/members/${doctor.membershipId}/deactivate`,
      undefined,
      clinic.owner.cookie,
    );
    expect(off.statusCode, off.body).toBe(200);
    const stored = Object.fromEntries(
      (await rowsOf(clinic.clinicId, today())).map((r) => [r.key, r.value]),
    );
    expect(stored).toMatchObject({ active_members: 1, active_branches: 1, sign_ins: 5 });
    expect((await usage(clinic.clinicId)).todayCounts.activeMembers).toBe(1);
  });
});

describe('the 30-day series (criterion 19)', () => {
  it('has 30 zero-filled days, oldest first, today last, and the 30 days before', async () => {
    const id = quiet.clinicId;
    await seed(id, dayBefore(1), 'sign_ins', 5);
    await seed(id, dayBefore(1), 'members_signed_in', 2);
    await seed(id, dayBefore(29), 'sign_ins', 7);
    await seed(id, dayBefore(30), 'sign_ins', 11);
    await seed(id, dayBefore(30), 'members_signed_in', 4);
    await seed(id, dayBefore(59), 'sign_ins', 13);
    await seed(id, dayBefore(60), 'sign_ins', 1000);
    const view = await usage(id);
    expect(view.days).toHaveLength(30);
    expect(view.days[0]).toEqual({ date: dayBefore(29), signIns: 7, membersSignedIn: 0 });
    expect(view.days[28]).toEqual({ date: dayBefore(1), signIns: 5, membersSignedIn: 2 });
    expect(view.days[29]?.date).toBe(today());
    expect(view.days.slice(1, 28).every((d) => d.signIns === 0 && d.membersSignedIn === 0)).toBe(
      true,
    );
    expect(view.previousTotals).toEqual({ signIns: 24, membersSignedIn: 4 });
  });

  it('says when a clinic has no counter row yet (`hasData`: false)', async () => {
    const created = await createClinicViaApi(world.app, world.admin.cookie, world.phone());
    const view = await usage(created.clinicId);
    expect(view.hasData).toBe(false);
    expect(view.lastActivityAt).toBeNull();
    expect(view.days).toHaveLength(30);
    expect(view.previousTotals).toEqual({ signIns: 0, membersSignedIn: 0 });
    expect(view.members).toBe(1);
  });

  it('answers 404 for an unknown clinic, and 403 to a clinic member', async () => {
    const res = await get(
      world.app,
      '/platform/clinics/00000000-0000-4000-8000-0000000000aa/usage',
      world.admin.cookie,
    );
    expect(res.statusCode).toBe(404);
    const member = await get(
      world.app,
      `/platform/clinics/${clinic.clinicId}/usage`,
      clinic.owner.cookie,
    );
    expect(member.statusCode).toBe(403);
  });
});

describe('the clinics list (criterion 21)', () => {
  it('shows last activity and the sign-ins of the last seven Damascus days', async () => {
    const id = quiet.clinicId;
    await seed(id, dayBefore(6), 'sign_ins', 2);
    await seed(id, dayBefore(7), 'sign_ins', 50);
    const minute = Math.floor((clock.now().getTime() - 3 * DAY_MS) / 60_000);
    await seed(id, dayBefore(3), 'last_activity_minute', minute);
    const rows = await summaries();
    const quietRow = rows.find((r) => r.id === id);
    // 1 (today, the owner's setup link) + 5 (yesterday) + 2 (six days ago); seven days ago and
    // earlier are out.
    expect(quietRow?.signIns7d).toBe(8);
    const busy = rows.find((r) => r.id === clinic.clinicId);
    expect(busy?.signIns7d).toBe(5);
    expect(busy?.lastActivityAt).not.toBeNull();
    // A clinic whose owner never set up: no activity yet.
    const unused = rows.find((r) => r.ownerStatus === 'pending');
    expect(unused).toMatchObject({ lastActivityAt: null, signIns7d: 0 });
  });

  it('keeps the newest activity of a clinic as its last activity', async () => {
    const id = quiet.clinicId;
    const view = await usage(id);
    // The owner's own requests stamp a later minute than the seeded one.
    expect(Date.parse(view.lastActivityAt ?? '')).toBeGreaterThan(
      clock.now().getTime() - 3 * DAY_MS,
    );
  });
});

describe('audit', () => {
  it('records each usage view as clinic.usage_viewed with the clinic as target', async () => {
    const rows = await auditRowsOf('clinic.usage_viewed');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === null && r.actorId !== null)).toBe(true);
    expect(rows.map((r) => r.targetId)).toContain(clinic.clinicId);
  });
});
