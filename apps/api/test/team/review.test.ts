// A-01-04 review findings, each with a test: a toggle switched through the API changes the
// member's next request on the real auth path (2); two owners deactivating each other at once
// leave one owner (1); the team list shows last activity (4); a deactivated member gets no link
// (6); two adds of one phone at once answer 201 and 409, never 500 (7).
import { testAuthDb, testDb, testPlatformDb } from '@shifa/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ProbeController, TEST_PERMISSIONS } from '../access/probe.ts';
import { testClock } from '../identity/support.ts';
import {
  CLINIC_WEB_URL,
  createClinicViaApi,
  resetDatabase,
  setUpOwner,
  signedInAdmin,
} from '../platform/support.ts';
import { buildTestApp, type TestApp } from '../support.ts';
import {
  activeMember,
  addMember,
  auditRowsOf,
  type Clinic,
  errorCode,
  get,
  mainBranch,
  membershipRow,
  patch,
  post,
  type TeamWorld,
  tokenOf,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let adminPhone = '';
let clinic: Clinic;

/** As teamWorld(), with the probe routes on the real auth path. */
async function probeWorld(): Promise<TeamWorld> {
  await resetDatabase();
  const app: TestApp = await buildTestApp({
    db: testDb(),
    authDb: testAuthDb(),
    platformDb: testPlatformDb(),
    clock,
    clinicWebUrl: CLINIC_WEB_URL,
    controllers: [ProbeController],
    permissions: TEST_PERMISSIONS,
  });
  const { syntheticPhones } = await import('@shifa/db/testing');
  const phones = syntheticPhones(2026_12_07, 60);
  let next = 0;
  const phone = () => phones[next++] ?? '';
  const admin = await signedInAdmin(app, clock, phone());
  adminPhone = admin.phone;
  return {
    app,
    clock,
    admin,
    phone,
    clinic: async () => {
      const ownerPhone = phone();
      const created = await createClinicViaApi(app, admin.cookie, ownerPhone);
      const owner = await setUpOwner(app, clock, created.linkUrl);
      return {
        clinicId: created.clinicId,
        ownerMembershipId: created.ownerMembershipId,
        owner,
        ownerPhone,
        branchId: await mainBranch(created.clinicId),
      };
    },
  };
}

beforeAll(async () => {
  world = await probeWorld();
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

const notes = (cookie: string) => get(world.app, '/__probe/notes', cookie);
const toggle = (id: string, granted: boolean | null) =>
  patch(
    world.app,
    `/team/members/${id}`,
    { permissions: [{ key: 'clinical.notes.view', granted }] },
    clinic.owner.cookie,
  );

describe('review 2: toggles through the API, on the real auth path', () => {
  it('a doctor switched off loses clinical notes on the next request, and back', async () => {
    const doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    expect((await notes(doctor.cookie)).statusCode).toBe(200);
    expect((await toggle(doctor.membershipId, false)).statusCode).toBe(200);
    expect((await notes(doctor.cookie)).statusCode).toBe(403);
    await toggle(doctor.membershipId, null);
    expect((await notes(doctor.cookie)).statusCode).toBe(200);
  });

  it('a receptionist switched on gains clinical notes on the next request', async () => {
    const desk = await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]);
    expect((await notes(desk.cookie)).statusCode).toBe(403);
    await toggle(desk.membershipId, true);
    expect((await notes(desk.cookie)).statusCode).toBe(200);
    // Switching twice at once never collides on the unique key.
    const both = await Promise.all([
      toggle(desk.membershipId, false),
      toggle(desk.membershipId, true),
    ]);
    expect(both.map((r) => r.statusCode)).toEqual([200, 200]);
  });
});

describe('review 1: the last owner under concurrency', () => {
  it('two owners deactivating each other at once leave one active owner', async () => {
    const own = await world.clinic();
    const second = await activeMember(world, own, [{ role: 'owner', branchId: null }]);
    // The second owner enrols TOTP to act (owners must, A-01a criterion 11).
    const { enrolTotp } = await import('../platform/support.ts');
    const enrolled = await enrolTotp(world.app, second.cookie, clock);
    const [a, b] = await Promise.all([
      post(world.app, `/team/members/${second.membershipId}/deactivate`, {}, own.owner.cookie),
      post(world.app, `/team/members/${own.ownerMembershipId}/deactivate`, {}, enrolled.cookie),
    ]);
    const statuses = [a.statusCode, b.statusCode].sort();
    expect(statuses).toEqual([200, 409]);
    expect([errorCode(a), errorCode(b)]).toContain('last_owner');
  });
});

describe('security review: OD-89 and N1', () => {
  it('a super admin cannot accept a clinic invitation (link_invalid); nothing is bound', async () => {
    const invited = await addMember(world.app, clinic.owner.cookie, {
      phone: adminPhone,
      roles: [{ role: 'doctor', branchId: null }],
    });
    expect(invited.res.statusCode).toBe(201);
    const res = await post(
      world.app,
      '/invitations/accept',
      { token: tokenOf(invited.linkUrl) },
      world.admin.cookie,
    );
    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe('link_invalid');
    const [row] = await membershipRow(invited.membershipId);
    expect(row).toMatchObject({ status: 'pending', userId: null });
  });

  it('an accepted invitation is also recorded on the auth path', async () => {
    const other = await world.clinic();
    const doctor = await activeMember(world, other, [{ role: 'doctor', branchId: null }]);
    const invited = await addMember(world.app, clinic.owner.cookie, {
      phone: doctor.phone,
      roles: [{ role: 'doctor', branchId: null }],
    });
    await post(
      world.app,
      '/invitations/accept',
      { token: tokenOf(invited.linkUrl) },
      doctor.cookie,
    );
    const rows = (await auditRowsOf('auth.link_used')).filter(
      (r) => r.targetId === invited.membershipId,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId: null,
      actorId: doctor.userId,
      data: { purpose: 'invitation' },
    });
  });
});

describe('review 4, 6, 7', () => {
  it('the team list shows when a member was last active', async () => {
    const doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    await get(world.app, '/auth/session', doctor.cookie);
    const list = await get(world.app, '/team/members', clinic.owner.cookie);
    const row = list
      .json<{ members: { id: string; lastActiveAt: string | null }[] }>()
      .members.find((m) => m.id === doctor.membershipId);
    expect(row?.lastActiveAt).not.toBeNull();
  });

  it('a deactivated member gets no link (409 member_deactivated): reactivate first', async () => {
    const added = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'assistant', branchId: null }],
    });
    await post(
      world.app,
      `/team/members/${added.membershipId}/deactivate`,
      {},
      clinic.owner.cookie,
    );
    const res = await post(
      world.app,
      `/team/members/${added.membershipId}/setup-link`,
      {},
      clinic.owner.cookie,
    );
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('member_deactivated');
  });

  it('two adds of one phone at once: one 201, one 409 phone_in_team', async () => {
    const phone = world.phone();
    const roles = [{ role: 'doctor' as const, branchId: null }];
    const both = await Promise.all([
      addMember(world.app, clinic.owner.cookie, { phone, roles }),
      addMember(world.app, clinic.owner.cookie, { phone, roles }),
    ]);
    expect(both.map((a) => a.res.statusCode).sort()).toEqual([201, 409]);
    expect(both.map((a) => errorCode(a.res))).toContain('phone_in_team');
  });
});
