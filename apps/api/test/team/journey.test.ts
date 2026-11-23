// A-01-04 end to end through the API: the owner adds a receptionist for one branch → the
// receptionist sets a password through the link → signed in with the branch role; a doctor of
// clinic A accepts clinic B's invitation → both clinics are theirs.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, sessionCookie, signIn, testClock } from '../identity/support.ts';
import {
  activeMember,
  addBranch,
  addMember,
  get,
  post,
  type TeamWorld,
  teamWorld,
  tokenOf,
  useMemberLink,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_06);
});

afterAll(async () => {
  await world.app.app.close();
});

describe('building a team', () => {
  it('owner adds a branch receptionist → link → password → signed in with the branch role', async () => {
    const clinic = await world.clinic();
    const second = await addBranch(clinic.clinicId);
    const phone = world.phone();
    const added = await addMember(world.app, clinic.owner.cookie, {
      name: 'موظفة الاستقبال',
      phone,
      roles: [{ role: 'receptionist', branchId: second }],
    });
    expect(added.res.statusCode).toBe(201);
    const view = await post(world.app, '/auth/setup-link/view', { token: tokenOf(added.linkUrl) });
    expect(view.json()).toMatchObject({ personName: 'موظفة الاستقبال', role: 'receptionist' });

    const cookie = await useMemberLink(world.app, added.linkUrl);
    const session = await get(world.app, '/auth/session', cookie);
    expect(session.json()).toMatchObject({
      tenantId: clinic.clinicId,
      mfa: 'none',
      mfaRequired: false,
      roles: [{ role: 'receptionist', tenantId: clinic.clinicId, branchId: second }],
    });
    // A receptionist does not manage the team.
    expect((await get(world.app, '/team/members', cookie)).statusCode).toBe(403);
    // The owner sees an active member.
    const list = await get(world.app, '/team/members', clinic.owner.cookie);
    expect(
      list
        .json<{ members: { id: string; status: string }[] }>()
        .members.find((m) => m.id === added.membershipId),
    ).toMatchObject({ status: 'active' });
    expect((await signIn(world.app, phone, PASSWORD)).statusCode).toBe(200);
  });

  it('a doctor of clinic A accepts clinic B’s invitation', async () => {
    const clinicA = await world.clinic();
    const clinicB = await world.clinic();
    const doctor = await activeMember(world, clinicA, [{ role: 'doctor', branchId: null }]);
    const invited = await addMember(world.app, clinicB.owner.cookie, {
      phone: doctor.phone,
      roles: [{ role: 'doctor', branchId: null }],
    });
    const accepted = await post(
      world.app,
      '/invitations/accept',
      { token: tokenOf(invited.linkUrl) },
      doctor.cookie,
    );
    expect(accepted.statusCode).toBe(204);
    // Two clinics: the chooser decides (A-01-05); the current session stays in clinic A.
    expect((await get(world.app, '/auth/session', doctor.cookie)).json()).toMatchObject({
      tenantId: clinicA.clinicId,
    });
    expect((await signIn(world.app, doctor.phone, PASSWORD)).json()).toMatchObject({
      tenantId: null,
    });
  });

  it('an owner of any clinic must enrol TOTP even before a clinic is chosen', async () => {
    // Backlog (A-01-03 review 2): the gate read "owner" from the active clinic only.
    const clinicA = await world.clinic();
    const clinicB = await world.clinic();
    const doctor = await activeMember(world, clinicA, [{ role: 'doctor', branchId: null }]);
    const invited = await addMember(world.app, clinicB.owner.cookie, {
      phone: doctor.phone,
      roles: [{ role: 'owner', branchId: null }],
    });
    await post(
      world.app,
      '/invitations/accept',
      { token: tokenOf(invited.linkUrl) },
      doctor.cookie,
    );
    const cookie = sessionCookie(await signIn(world.app, doctor.phone, PASSWORD));
    const session = await get(world.app, '/auth/session', cookie);
    expect(session.json()).toMatchObject({ tenantId: null, mfaRequired: true, mfa: 'none' });
    const blocked = await get(world.app, '/auth/sessions', cookie);
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json()).toMatchObject({ error: { code: 'mfa_enrolment_required' } });
  });
});
