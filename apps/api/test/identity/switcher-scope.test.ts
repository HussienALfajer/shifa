// A-01b criterion 10 (A-01-09): the chooser says whether a person's role covers the whole clinic
// (`tenantWide`), and a person holding roles in two or more branches and no tenant-wide role
// picks a branch: a switch without one is 400 `branch_required`, and their sign-in starts in no
// clinic (the chooser's branch step), never on "all branches".
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  activeMember,
  addBranch,
  type Clinic,
  errorCode,
  get,
  post,
  type TeamWorld,
  teamWorld,
} from '../team/support.ts';
import { PASSWORD, signIn, testClock } from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let second: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_11_29);
  clinic = await world.clinic();
  second = await addBranch(clinic.clinicId, 'فرع العزيزية');
});

afterAll(async () => {
  await world.app.app.close();
});

const choiceOf = async (cookie: string) => {
  const res = await get(world.app, '/me/clinics', cookie);
  expect(res.statusCode, res.body).toBe(200);
  const { clinics } = res.json<{ clinics: { tenantId: string; tenantWide: boolean }[] }>();
  return clinics.find((c) => c.tenantId === clinic.clinicId);
};
const switchTo = (cookie: string, branchId?: string | null) =>
  post(
    world.app,
    '/me/switch',
    branchId === undefined
      ? { tenantId: clinic.clinicId }
      : { tenantId: clinic.clinicId, branchId },
    cookie,
  );

describe('tenant-wide roles and the branch step (criterion 10)', () => {
  it('a tenant-wide role: tenantWide true, a switch without a branch lands on all branches', async () => {
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    expect((await choiceOf(m.cookie))?.tenantWide).toBe(true);
    const res = await switchTo(m.cookie);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ tenantId: clinic.clinicId, branchId: null });
    expect((await choiceOf(clinic.owner.cookie))?.tenantWide).toBe(true);
  });

  it('roles in one branch only: tenantWide false, a switch without a branch lands in it', async () => {
    const m = await activeMember(world, clinic, [{ role: 'receptionist', branchId: second }]);
    expect((await choiceOf(m.cookie))?.tenantWide).toBe(false);
    const res = await switchTo(m.cookie);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual({ tenantId: clinic.clinicId, branchId: second });
  });

  it('roles in two branches and none tenant-wide: 400 branch_required without a branch', async () => {
    const m = await activeMember(world, clinic, [
      { role: 'doctor', branchId: clinic.branchId },
      { role: 'doctor', branchId: second },
    ]);
    expect((await choiceOf(m.cookie))?.tenantWide).toBe(false);
    for (const branchId of [undefined, null]) {
      const res = await switchTo(m.cookie, branchId);
      expect(res.statusCode).toBe(400);
      expect(errorCode(res)).toBe('branch_required');
    }
    const picked = await switchTo(m.cookie, second);
    expect(picked.statusCode).toBe(200);
    expect(picked.json()).toEqual({ tenantId: clinic.clinicId, branchId: second });
  });

  it('that person’s sign-in starts in no clinic (the chooser’s branch step)', async () => {
    const m = await activeMember(world, clinic, [
      { role: 'assistant', branchId: clinic.branchId },
      { role: 'accountant', branchId: second },
    ]);
    const res = await signIn(world.app, m.phone, PASSWORD);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ tenantId: null, branchId: null });
  });
});
