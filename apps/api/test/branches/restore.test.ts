// A-01b criterion 9, OD-105 (A-01-12): the owner restores an archived branch. It returns to the
// active list, the switcher and the role picker; the roles that pointed at it stand again, so a
// member whose only role was there signs in and switches into it. Restoring a branch that is not
// archived answers 409 `branch_not_archived`; another clinic's branch is not found; one audit row
// `branch.restored`; a receptionist is refused.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, sessionCookie, signIn, testClock } from '../identity/support.ts';
import {
  activeMember,
  addMember,
  type Clinic,
  errorCode,
  get,
  post,
  type TeamWorld,
  teamWorld,
  tenantAuditRows,
} from '../team/support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;

interface BranchBody {
  id: string;
  archivedAt: string | null;
  memberCount: number;
}

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_12);
  clinic = await world.clinic();
  other = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

async function archivedBranch(c: Clinic, name = 'فرع مؤرشف'): Promise<string> {
  const created = await post(world.app, '/branches', { name }, c.owner.cookie);
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json<BranchBody>().id;
  const archived = await post(world.app, `/branches/${id}/archive`, {}, c.owner.cookie);
  expect(archived.statusCode, archived.body).toBe(200);
  return id;
}

const restore = (id: string, cookie: string = clinic.owner.cookie) =>
  post(world.app, `/branches/${id}/restore`, {}, cookie);

describe('restoring an archived branch (OD-105)', () => {
  it('returns it to the active list, the role picker and the member’s switcher', async () => {
    const created = await post(
      world.app,
      '/branches',
      { name: 'فرع الشهباء' },
      clinic.owner.cookie,
    );
    const id = created.json<BranchBody>().id;
    const doctor = await activeMember(world, clinic, [{ role: 'doctor', branchId: id }]);
    expect(
      (await post(world.app, `/branches/${id}/archive`, {}, clinic.owner.cookie)).statusCode,
    ).toBe(200);
    // Archived: the doctor's only branch is gone; their session here ended.
    expect((await get(world.app, '/auth/session', doctor.cookie)).statusCode).toBe(401);

    const res = await restore(id);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<BranchBody>()).toMatchObject({ id, archivedAt: null, memberCount: 1 });

    const list = (await get(world.app, '/branches', clinic.owner.cookie)).json<{
      active: BranchBody[];
      archived: BranchBody[];
    }>();
    expect(list.active.map((b) => b.id)).toContain(id);
    expect(list.archived.map((b) => b.id)).not.toContain(id);

    // The role that pointed at it stands again: sign-in goes into the clinic and that branch.
    const again = await signIn(world.app, doctor.phone, PASSWORD);
    expect(again.json()).toMatchObject({ tenantId: clinic.clinicId });
    const cookie = sessionCookie(again);
    const clinics = (await get(world.app, '/me/clinics', cookie)).json<{
      clinics: { tenantId: string; branches: { id: string }[] }[];
    }>();
    expect(
      clinics.clinics.find((c) => c.tenantId === clinic.clinicId)?.branches.map((b) => b.id),
    ).toEqual([id]);
    const switched = await post(
      world.app,
      '/me/switch',
      { tenantId: clinic.clinicId, branchId: id },
      cookie,
    );
    expect(switched.statusCode, switched.body).toBe(200);

    // The role picker accepts it again.
    const added = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'assistant', branchId: id }],
    });
    expect(added.res.statusCode, added.res.body).toBe(201);
  });

  it('refuses a branch that is not archived (409 branch_not_archived)', async () => {
    const res = await restore(clinic.branchId);
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('branch_not_archived');
  });

  it('another clinic’s branch is not found (404); an unknown id too', async () => {
    const theirs = await archivedBranch(other, 'فرع عيادة أخرى');
    expect((await restore(theirs)).statusCode).toBe(404);
    const list = (await get(world.app, '/branches', other.owner.cookie)).json<{
      archived: BranchBody[];
    }>();
    expect(list.archived.map((b) => b.id)).toContain(theirs);
    expect((await restore('0193c5a4-7b2e-7c1a-9f00-00000000dead')).statusCode).toBe(404);
  });

  it('a receptionist is refused (403)', async () => {
    const id = await archivedBranch(clinic, 'فرع للاستقبال');
    const desk = await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]);
    expect((await restore(id, desk.cookie)).statusCode).toBe(403);
  });

  it('writes one audit row branch.restored', async () => {
    const c = await world.clinic();
    const id = await archivedBranch(c, 'فرع للتدقيق');
    expect((await restore(id, c.owner.cookie)).statusCode).toBe(200);
    const ownerId = (await get(world.app, '/auth/session', c.owner.cookie)).json<{
      userId: string;
    }>().userId;
    const rows = (await tenantAuditRows(c.clinicId)).filter((r) => r.event === 'branch.restored');
    expect(rows.map((r) => [r.targetId, r.actorId])).toEqual([[id, ownerId]]);
  });
});
