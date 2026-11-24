// OD-97 (A-01-09 security review M1): an owner cannot remove another owner's owner role, so a
// co-owner cannot demote an owner, reset their TOTP and take the account over through a new
// link. The owner themselves still may give it up (while another owner stays).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import { enrolTotp } from '../platform/support.ts';
import {
  activeMember,
  type Clinic,
  errorCode,
  get,
  patch,
  post,
  type TeamWorld,
  teamWorld,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_02);
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

/** A second owner of the clinic, set up with TOTP (owners must enrol). */
async function coOwner() {
  const m = await activeMember(world, clinic, [{ role: 'owner', branchId: null }]);
  const enrolled = await enrolTotp(world.app, m.cookie, clock);
  return { ...m, cookie: enrolled.cookie };
}

const setRoles = (id: string, cookie: string, role: 'doctor' | 'owner') =>
  patch(world.app, `/team/members/${id}`, { roles: [{ role, branchId: null }] }, cookie);

describe('another owner’s owner role (OD-97)', () => {
  it('a co-owner cannot remove it (409 owner_role_protected); nothing changes', async () => {
    const b = await coOwner();
    const res = await setRoles(b.membershipId, clinic.owner.cookie, 'doctor');
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('owner_role_protected');
    const detail = await get(world.app, `/team/members/${b.membershipId}`, clinic.owner.cookie);
    expect(detail.json()).toMatchObject({ roles: [{ role: 'owner' }] });
    // So the takeover chain stops at its first step: the owner's TOTP cannot be reset.
    const reset = await post(
      world.app,
      `/team/members/${b.membershipId}/reset-mfa`,
      {},
      clinic.owner.cookie,
    );
    expect(errorCode(reset)).toBe('owner_mfa_platform');
  });

  it('the owner may give up their own owner role while another owner stays', async () => {
    const b = await coOwner();
    const res = await setRoles(b.membershipId, b.cookie, 'doctor');
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ roles: [{ role: 'doctor' }] });
  });

  it('a co-owner may still give the owner role to a member', async () => {
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const res = await setRoles(m.membershipId, clinic.owner.cookie, 'owner');
    expect(res.statusCode, res.body).toBe(200);
  });
});
