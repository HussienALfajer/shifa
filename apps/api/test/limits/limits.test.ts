// A-02 criterion 4 (OD-110; contract rows `add409`, `branchesFull`, `restoreRefused`): the doctor
// limit counts non-deactivated members holding a doctor role (pending included), the branch limit
// non-archived branches. Adding a doctor role (new member, edit, reactivation) and creating or
// restoring a branch beyond the limit answer 409 `limit_reached` with key, limit and used, and
// nothing is written. A limit lowered below use keeps what exists. Two requests racing at the
// limit never both succeed.
import { ErrorEnvelope } from '@shifa/contracts';
import { branch, membership, roleAssignment } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { and, eq, isNull } from 'drizzle-orm';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { put } from '../entitlements/support.ts';
import { testClock } from '../identity/support.ts';
import {
  addMember,
  type Clinic,
  errorCode,
  get,
  patch,
  post,
  type RoleScope,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
const REASON = 'حد تجريبي لاختبار الحدود في العيادة';
const DOCTOR = [{ role: 'doctor' as const, branchId: null }];
const RECEPTION = [{ role: 'receptionist' as const, branchId: null }];
const su = () => superuserDb(workerDatabaseName());

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_21);
});

beforeEach(async () => {
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

async function setLimit(key: 'limits.practitioners' | 'limits.branches', value: number) {
  const res = await put(
    world.app,
    `/platform/clinics/${clinic.clinicId}/overrides/${key}`,
    { value, reason: REASON },
    world.admin.cookie,
  );
  expect(res.statusCode, res.body).toBe(200);
}

function expectLimit(res: LightMyRequestResponse, key: string, limit: number, used: number) {
  expect(res.statusCode, res.body).toBe(409);
  const body = ErrorEnvelope.parse(res.json());
  expect(body.error.code).toBe('limit_reached');
  expect(body.error.limitReached).toEqual({ key, limit, used });
}

const add = (roles: RoleScope[] = DOCTOR) =>
  addMember(world.app, clinic.owner.cookie, { phone: world.phone(), roles });

async function memberIds(): Promise<string[]> {
  const rows = await su()
    .select({ id: membership.id })
    .from(membership)
    .where(eq(membership.tenantId, clinic.clinicId));
  return rows.map((r) => r.id).sort();
}

async function activeBranches(): Promise<number> {
  const rows = await su()
    .select({ id: branch.id })
    .from(branch)
    .where(and(eq(branch.tenantId, clinic.clinicId), isNull(branch.archivedAt)));
  return rows.length;
}

async function rolesOf(membershipId: string): Promise<string[]> {
  const rows = await su()
    .select({ role: roleAssignment.role })
    .from(roleAssignment)
    .where(eq(roleAssignment.membershipId, membershipId));
  return rows.map((r) => r.role).sort();
}

describe('the doctor limit (criterion 4)', () => {
  it('a new doctor at the limit: 409 with key, limit and used; nothing written', async () => {
    await setLimit('limits.practitioners', 2);
    expect((await add()).res.statusCode).toBe(201);
    // A pending member counts.
    expect((await add()).res.statusCode).toBe(201);
    const before = await memberIds();
    const refused = await add();
    expectLimit(refused.res, 'limits.practitioners', 2, 2);
    expect(await memberIds()).toEqual(before);
  });

  it('a member without a doctor role is still added at the limit', async () => {
    await setLimit('limits.practitioners', 1);
    expect((await add()).res.statusCode).toBe(201);
    expect((await add(RECEPTION)).res.statusCode).toBe(201);
  });

  it('an edit adding a doctor role at the limit: 409; the roles stay', async () => {
    await setLimit('limits.practitioners', 1);
    expect((await add()).res.statusCode).toBe(201);
    const receptionist = await add(RECEPTION);
    const res = await patch(
      world.app,
      `/team/members/${receptionist.membershipId}`,
      { roles: [...RECEPTION, ...DOCTOR] },
      clinic.owner.cookie,
    );
    expectLimit(res, 'limits.practitioners', 1, 1);
    expect(await rolesOf(receptionist.membershipId)).toEqual(['receptionist']);
  });

  it('an edit of a member who already holds the doctor role passes at the limit', async () => {
    await setLimit('limits.practitioners', 1);
    const doctor = await add();
    const res = await patch(
      world.app,
      `/team/members/${doctor.membershipId}`,
      { roles: [...DOCTOR, ...RECEPTION] },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
  });

  it('reactivating a doctor at the limit: 409; the member stays deactivated', async () => {
    await setLimit('limits.practitioners', 1);
    const first = await add();
    const off = await post(
      world.app,
      `/team/members/${first.membershipId}/deactivate`,
      {},
      clinic.owner.cookie,
    );
    expect(off.statusCode, off.body).toBe(200);
    expect((await add()).res.statusCode).toBe(201);
    const res = await post(
      world.app,
      `/team/members/${first.membershipId}/reactivate`,
      {},
      clinic.owner.cookie,
    );
    expectLimit(res, 'limits.practitioners', 1, 1);
    const detail = await get(world.app, `/team/members/${first.membershipId}`, clinic.owner.cookie);
    expect(detail.json()).toMatchObject({ status: 'deactivated' });
  });

  it('reactivating a member without a doctor role passes at the limit', async () => {
    await setLimit('limits.practitioners', 1);
    const receptionist = await add(RECEPTION);
    await post(
      world.app,
      `/team/members/${receptionist.membershipId}/deactivate`,
      {},
      clinic.owner.cookie,
    );
    expect((await add()).res.statusCode).toBe(201);
    const res = await post(
      world.app,
      `/team/members/${receptionist.membershipId}/reactivate`,
      {},
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
  });

  it('a limit lowered below use keeps every doctor; only new ones are refused', async () => {
    for (let i = 0; i < 3; i++) expect((await add()).res.statusCode).toBe(201);
    await setLimit('limits.practitioners', 1);
    const list = await get(world.app, '/team/members', clinic.owner.cookie);
    const doctors = list
      .json<{ members: { roles: { role: string }[]; status: string }[] }>()
      .members.filter((m) => m.roles.some((r) => r.role === 'doctor'));
    expect(doctors).toHaveLength(3);
    const [one] = await memberIds();
    const renamed = await patch(
      world.app,
      `/team/members/${one ?? ''}`,
      { name: 'اسم جديد للطبيب' },
      clinic.owner.cookie,
    );
    expect(renamed.statusCode, renamed.body).toBe(200);
    expectLimit((await add()).res, 'limits.practitioners', 1, 3);
  });

  it('concurrent adds at the limit: exactly one succeeds', async () => {
    await setLimit('limits.practitioners', 1);
    const results = await Promise.all(Array.from({ length: 5 }, () => add()));
    const statuses = results.map((r) => r.res.statusCode).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    for (const r of results.filter((x) => x.res.statusCode === 409)) {
      expect(errorCode(r.res)).toBe('limit_reached');
    }
  });
});

describe('the branch limit (criterion 4)', () => {
  const createBranch = (name = 'فرع الحد') =>
    post(world.app, '/branches', { name }, clinic.owner.cookie);

  it('a new branch at the limit: 409 with key, limit and used; nothing written', async () => {
    await setLimit('limits.branches', 1);
    expect(await activeBranches()).toBe(1);
    expectLimit(await createBranch(), 'limits.branches', 1, 1);
    expect(await activeBranches()).toBe(1);
  });

  it('an archived branch does not count; restoring it beyond the limit: 409', async () => {
    await setLimit('limits.branches', 2);
    const created = await createBranch('فرع يؤرشف');
    expect(created.statusCode, created.body).toBe(201);
    const id = created.json<{ id: string }>().id;
    const archived = await post(world.app, `/branches/${id}/archive`, {}, clinic.owner.cookie);
    expect(archived.statusCode, archived.body).toBe(200);
    expect((await createBranch('فرع ثان')).statusCode).toBe(201);
    const restored = await post(world.app, `/branches/${id}/restore`, {}, clinic.owner.cookie);
    expectLimit(restored, 'limits.branches', 2, 2);
    expect(await activeBranches()).toBe(2);
  });

  it('concurrent creates at the limit: exactly one succeeds', async () => {
    await setLimit('limits.branches', 2);
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => createBranch(`فرع متزامن ${String(i)}`)),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409, 409, 409]);
    expect(await activeBranches()).toBe(2);
  });
});
