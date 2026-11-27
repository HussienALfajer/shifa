// Review of A-02-03 (N4): every path that adds a counted doctor or branch takes the same limits
// lock, so a race between two different paths at the limit never lets both through: an edit
// adding a doctor role against a new doctor, a reactivation against a new doctor, and a branch
// restore against a new branch.
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { put } from '../entitlements/support.ts';
import { testClock } from '../identity/support.ts';
import {
  addMember,
  type Clinic,
  patch,
  post,
  type RoleScope,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
const REASON = 'حد تجريبي لاختبار السباق بين الطلبات';
const DOCTOR: RoleScope[] = [{ role: 'doctor', branchId: null }];
const RECEPTION: RoleScope[] = [{ role: 'receptionist', branchId: null }];

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_27);
});

beforeEach(async () => {
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

async function setLimit(key: string, value: number) {
  const res = await put(
    world.app,
    `/platform/clinics/${clinic.clinicId}/overrides/${key}`,
    { value, reason: REASON },
    world.admin.cookie,
  );
  expect(res.statusCode, res.body).toBe(200);
}

const add = (roles: RoleScope[]) =>
  addMember(world.app, clinic.owner.cookie, { phone: world.phone(), roles });

/** Exactly one success (200 or 201) and one 409 `limit_reached`, whatever the order. */
function oneEach(a: LightMyRequestResponse, b: LightMyRequestResponse) {
  const passed = [a, b].filter((r) => r.statusCode === 200 || r.statusCode === 201);
  const refused = [a, b].filter((r) => r.statusCode === 409);
  expect(passed, `${a.body} | ${b.body}`).toHaveLength(1);
  expect(refused).toHaveLength(1);
  expect(refused[0]?.json<{ error: { code: string } }>().error.code).toBe('limit_reached');
}

describe('races between paths at the limit (criterion 4)', () => {
  it('an edit adding a doctor role against a new doctor', async () => {
    await setLimit('limits.practitioners', 1);
    const receptionist = await add(RECEPTION);
    const [edit, added] = await Promise.all([
      patch(
        world.app,
        `/team/members/${receptionist.membershipId}`,
        { roles: [...RECEPTION, ...DOCTOR] },
        clinic.owner.cookie,
      ),
      add(DOCTOR).then((r) => r.res),
    ]);
    oneEach(edit, added);
  });

  it('a reactivation against a new doctor', async () => {
    await setLimit('limits.practitioners', 1);
    const doctor = await add(DOCTOR);
    await post(
      world.app,
      `/team/members/${doctor.membershipId}/deactivate`,
      {},
      clinic.owner.cookie,
    );
    const [back, added] = await Promise.all([
      post(world.app, `/team/members/${doctor.membershipId}/reactivate`, {}, clinic.owner.cookie),
      add(DOCTOR).then((r) => r.res),
    ]);
    oneEach(back, added);
  });

  it('a branch restore against a new branch', async () => {
    await setLimit('limits.branches', 2);
    const created = await post(world.app, '/branches', { name: 'فرع يؤرشف' }, clinic.owner.cookie);
    const id = created.json<{ id: string }>().id;
    await post(world.app, `/branches/${id}/archive`, {}, clinic.owner.cookie);
    const [restored, made] = await Promise.all([
      post(world.app, `/branches/${id}/restore`, {}, clinic.owner.cookie),
      post(world.app, '/branches', { name: 'فرع جديد' }, clinic.owner.cookie),
    ]);
    oneEach(restored, made);
  });
});
