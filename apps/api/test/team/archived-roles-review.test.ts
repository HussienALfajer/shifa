// A-01-13 security review: (B1) a branch id in upper case is the same branch, so it cannot slip
// a new assignment into an archived branch past the check, on an edit or an add; (N1) an edit
// that leaves a member only roles in archived branches ends their sessions here, as archiving
// those branches would have (criterion 4, OD-105).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  type Clinic,
  errorCode,
  get,
  patch,
  post,
  sessionsOf,
  type TeamWorld,
  teamWorld,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_26);
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

async function archivedBranch(name: string): Promise<string> {
  const res = await post(world.app, '/branches', { name }, clinic.owner.cookie);
  expect(res.statusCode, res.body).toBe(201);
  const id = res.json<{ id: string }>().id;
  const archived = await post(world.app, `/branches/${id}/archive`, {}, clinic.owner.cookie);
  expect(archived.statusCode, archived.body).toBe(200);
  return id;
}

describe('B1: the id’s case does not matter', () => {
  it('a new role in an archived branch named in upper case is refused on an edit', async () => {
    const archived = await archivedBranch('فرع أحرف كبيرة');
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: clinic.branchId }]);
    const res = await patch(
      world.app,
      `/team/members/${m.membershipId}`,
      {
        roles: [
          { role: 'doctor', branchId: clinic.branchId },
          { role: 'receptionist', branchId: archived.toUpperCase() },
        ],
      },
      clinic.owner.cookie,
    );
    expect([res.statusCode, errorCode(res)]).toEqual([409, 'branch_archived']);
  });

  it('adding a member there in upper case is refused', async () => {
    const archived = await archivedBranch('فرع أحرف كبيرة ثان');
    const res = await post(
      world.app,
      '/team/members',
      {
        name: 'موظف جديد',
        phone: world.phone(),
        roles: [{ role: 'doctor', branchId: archived.toUpperCase() }],
      },
      clinic.owner.cookie,
    );
    expect([res.statusCode, errorCode(res)]).toEqual([409, 'branch_archived']);
  });

  it('a held role sent back in upper case is kept, once', async () => {
    const branch = await post(world.app, '/branches', { name: 'فرع للحفظ' }, clinic.owner.cookie);
    const id = branch.json<{ id: string }>().id;
    const m = await activeMember(world, clinic, [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: id },
    ]);
    await post(world.app, `/branches/${id}/archive`, {}, clinic.owner.cookie);
    const res = await patch(
      world.app,
      `/team/members/${m.membershipId}`,
      {
        roles: [
          { role: 'doctor', branchId: clinic.branchId },
          { role: 'doctor', branchId: id.toUpperCase() },
          { role: 'doctor', branchId: id },
        ],
      },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    const roles = (await get(world.app, `/team/members/${m.membershipId}`, clinic.owner.cookie))
      .json<{ roles: { branchId: string | null }[] }>()
      .roles.map((r) => r.branchId);
    expect(roles.filter((b) => b === id)).toHaveLength(1);
  });
});

describe('N1: left with archived-branch roles only', () => {
  it('the member’s sessions here end, as archiving would have', async () => {
    const branch = await post(world.app, '/branches', { name: 'فرع للجلسات' }, clinic.owner.cookie);
    const id = branch.json<{ id: string }>().id;
    const m = await activeMember(world, clinic, [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: id },
    ]);
    // In the clinic, in the main branch: two branches held, the session chose one.
    const switched = await post(
      world.app,
      '/me/switch',
      { tenantId: clinic.clinicId, branchId: clinic.branchId },
      m.cookie,
    );
    expect(switched.statusCode, switched.body).toBe(200);
    await post(world.app, `/branches/${id}/archive`, {}, clinic.owner.cookie);
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(200);
    const res = await patch(
      world.app,
      `/team/members/${m.membershipId}`,
      { roles: [{ role: 'doctor', branchId: id }] },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(await sessionsOf(m.userId)).toHaveLength(0);
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(401);
  });

  it('a member keeping an active role keeps their session', async () => {
    const branch = await post(world.app, '/branches', { name: 'فرع للبقاء' }, clinic.owner.cookie);
    const id = branch.json<{ id: string }>().id;
    const m = await activeMember(world, clinic, [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: id },
    ]);
    await post(world.app, `/branches/${id}/archive`, {}, clinic.owner.cookie);
    const res = await patch(
      world.app,
      `/team/members/${m.membershipId}`,
      {
        roles: [
          { role: 'doctor', branchId: clinic.branchId },
          { role: 'doctor', branchId: id },
          { role: 'assistant', branchId: clinic.branchId },
        ],
      },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(200);
  });
});
