// A-01-13, OD-107: a role a member already holds in an archived branch (kept for a restore,
// OD-105) does not block the owner's edits. `PATCH /team/members/:id` keeps such an assignment
// when the list sends it back and drops it when the list leaves it out; only a new assignment
// in an archived branch is refused (409 `branch_archived`), also another role in the same
// archived branch and a role another member holds there. Another clinic's branch stays unknown
// (400). The edit is audited once, without a phone; a restore gives a kept role back.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  type Clinic,
  errorCode,
  get,
  patch,
  post,
  type RoleScope,
  type TeamWorld,
  teamWorld,
  tenantAuditRows,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;

interface DetailRole {
  role: string;
  branchId: string | null;
}

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_19);
  clinic = await world.clinic();
  other = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

async function newBranch(c: Clinic, name: string): Promise<string> {
  const res = await post(world.app, '/branches', { name }, c.owner.cookie);
  expect(res.statusCode, res.body).toBe(201);
  return res.json<{ id: string }>().id;
}

async function archive(c: Clinic, id: string): Promise<void> {
  const res = await post(world.app, `/branches/${id}/archive`, {}, c.owner.cookie);
  expect(res.statusCode, res.body).toBe(200);
}

const editRoles = (c: Clinic, membershipId: string, roles: RoleScope[]) =>
  patch(world.app, `/team/members/${membershipId}`, { roles }, c.owner.cookie);

async function rolesOf(c: Clinic, membershipId: string): Promise<DetailRole[]> {
  const res = await get(world.app, `/team/members/${membershipId}`, c.owner.cookie);
  expect(res.statusCode, res.body).toBe(200);
  return res
    .json<{ roles: DetailRole[] }>()
    .roles.map(({ role, branchId }) => ({ role, branchId }))
    .sort(byKey);
}

const keyOf = (r: DetailRole) => `${r.role}:${r.branchId ?? ''}`;
const byKey = (a: DetailRole, b: DetailRole) => keyOf(a).localeCompare(keyOf(b));
const sorted = (roles: DetailRole[]) => [...roles].sort(byKey);

/** A doctor in the main branch and in a second branch, which is then archived. */
async function memberWithArchivedRole(c: Clinic) {
  const archived = await newBranch(c, 'فرع سيؤرشف');
  const m = await activeMember(world, c, [
    { role: 'doctor', branchId: c.branchId },
    { role: 'doctor', branchId: archived },
  ]);
  await archive(c, archived);
  return { m, archived };
}

describe('a held archived-branch role (OD-107)', () => {
  it('is kept when the list sends it back with another change', async () => {
    const { m, archived } = await memberWithArchivedRole(clinic);
    const roles: RoleScope[] = [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: archived },
      { role: 'receptionist', branchId: clinic.branchId },
    ];
    const res = await editRoles(clinic, m.membershipId, roles);
    expect(res.statusCode, res.body).toBe(200);
    expect(await rolesOf(clinic, m.membershipId)).toEqual(sorted(roles));
  });

  it('is kept when the save changes only the name beside the same roles', async () => {
    const { m, archived } = await memberWithArchivedRole(clinic);
    const roles: RoleScope[] = [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: archived },
    ];
    const res = await patch(
      world.app,
      `/team/members/${m.membershipId}`,
      { roles, name: 'طبيب معدّل' },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(await rolesOf(clinic, m.membershipId)).toEqual(sorted(roles));
  });

  it('is dropped when the list leaves it out, and a restore does not bring it back', async () => {
    const { m, archived } = await memberWithArchivedRole(clinic);
    const res = await editRoles(clinic, m.membershipId, [
      { role: 'doctor', branchId: clinic.branchId },
    ]);
    expect(res.statusCode, res.body).toBe(200);
    expect(await rolesOf(clinic, m.membershipId)).toEqual([
      { role: 'doctor', branchId: clinic.branchId },
    ]);
    const restored = await post(
      world.app,
      `/branches/${archived}/restore`,
      {},
      clinic.owner.cookie,
    );
    expect(restored.statusCode, restored.body).toBe(200);
    expect(await rolesOf(clinic, m.membershipId)).toEqual([
      { role: 'doctor', branchId: clinic.branchId },
    ]);
  });

  it('kept through an edit stands again after a restore', async () => {
    const { m, archived } = await memberWithArchivedRole(clinic);
    const roles: RoleScope[] = [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: archived },
      { role: 'assistant', branchId: clinic.branchId },
    ];
    expect((await editRoles(clinic, m.membershipId, roles)).statusCode).toBe(200);
    const restored = await post(
      world.app,
      `/branches/${archived}/restore`,
      {},
      clinic.owner.cookie,
    );
    expect(restored.statusCode, restored.body).toBe(200);
    const clinics = (await get(world.app, '/me/clinics', m.cookie)).json<{
      clinics: { tenantId: string; branches: { id: string }[] }[];
    }>();
    expect(
      clinics.clinics
        .find((c) => c.tenantId === clinic.clinicId)
        ?.branches.map((b) => b.id)
        .sort(),
    ).toEqual([clinic.branchId, archived].sort());
  });

  it('a member whose only role is in the archived branch keeps it through a rename', async () => {
    const archived = await newBranch(clinic, 'فرع وحيد سيؤرشف');
    const m = await activeMember(world, clinic, [{ role: 'assistant', branchId: archived }]);
    await archive(clinic, archived);
    const roles: RoleScope[] = [{ role: 'assistant', branchId: archived }];
    const res = await patch(
      world.app,
      `/team/members/${m.membershipId}`,
      { name: 'مساعد معدّل', roles },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(await rolesOf(clinic, m.membershipId)).toEqual(roles);
  });
});

describe('a new assignment in an archived branch is still refused (409 branch_archived)', () => {
  it('another role in the same archived branch', async () => {
    const { m, archived } = await memberWithArchivedRole(clinic);
    const res = await editRoles(clinic, m.membershipId, [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: archived },
      { role: 'receptionist', branchId: archived },
    ]);
    expect([res.statusCode, errorCode(res)]).toEqual([409, 'branch_archived']);
    // Nothing changed: the held role stays, the new one was not written.
    expect(await rolesOf(clinic, m.membershipId)).toEqual(
      sorted([
        { role: 'doctor', branchId: clinic.branchId },
        { role: 'doctor', branchId: archived },
      ]),
    );
  });

  it('a role another member holds there is not this member’s to keep', async () => {
    const { archived } = await memberWithArchivedRole(clinic);
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: clinic.branchId }]);
    const res = await editRoles(clinic, m.membershipId, [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: archived },
    ]);
    expect([res.statusCode, errorCode(res)]).toEqual([409, 'branch_archived']);
    expect(await rolesOf(clinic, m.membershipId)).toEqual([
      { role: 'doctor', branchId: clinic.branchId },
    ]);
  });

  it('a held role dropped in one save cannot come back in the next', async () => {
    const { m, archived } = await memberWithArchivedRole(clinic);
    expect(
      (await editRoles(clinic, m.membershipId, [{ role: 'doctor', branchId: clinic.branchId }]))
        .statusCode,
    ).toBe(200);
    const res = await editRoles(clinic, m.membershipId, [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: archived },
    ]);
    expect([res.statusCode, errorCode(res)]).toEqual([409, 'branch_archived']);
  });

  it('adding a member in an archived branch', async () => {
    const { archived } = await memberWithArchivedRole(clinic);
    const res = await post(
      world.app,
      '/team/members',
      { name: 'موظف جديد', phone: world.phone(), roles: [{ role: 'doctor', branchId: archived }] },
      clinic.owner.cookie,
    );
    expect([res.statusCode, errorCode(res)]).toEqual([409, 'branch_archived']);
  });
});

describe('tenancy and audit', () => {
  it('another clinic’s archived branch is unknown here (400), even with a held id', async () => {
    const { archived: theirs } = await memberWithArchivedRole(other);
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: clinic.branchId }]);
    const res = await editRoles(clinic, m.membershipId, [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: theirs },
    ]);
    expect([res.statusCode, errorCode(res)]).toEqual([400, 'validation_failed']);
  });

  it('a kept edit is one member.roles_changed row without a phone', async () => {
    const c = await world.clinic();
    const { m, archived } = await memberWithArchivedRole(c);
    const res = await editRoles(c, m.membershipId, [
      { role: 'doctor', branchId: c.branchId },
      { role: 'doctor', branchId: archived },
      { role: 'receptionist', branchId: c.branchId },
    ]);
    expect(res.statusCode, res.body).toBe(200);
    const rows = (await tenantAuditRows(c.clinicId)).filter(
      (r) => r.event === 'member.roles_changed' && r.targetId === m.membershipId,
    );
    expect(rows).toHaveLength(1);
    const text = JSON.stringify(rows);
    expect(text).not.toContain(m.phone);
    expect(text).not.toContain(m.phone.slice(4));
  });
});
