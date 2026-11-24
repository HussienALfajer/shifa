// A-01b criterion 2 and the invitation routes: a phone with an account gets an invitation; its
// page shows the clinic, roles and scope; only the signed-in person with that phone accepts or
// declines it; until accepted the clinic is absent from that person's clinics; a used, declined
// or wrong-person invitation answers one message (404 link_invalid).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, sessionCookie, signIn, testClock } from '../identity/support.ts';
import {
  activeMember,
  addMember,
  type Clinic,
  errorCode,
  get,
  membershipRow,
  post,
  type TeamWorld,
  teamWorld,
  tokenOf,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinicA: Clinic;
let clinicB: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_03);
  clinicA = await world.clinic();
  clinicB = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

/** A doctor of clinic A invited to clinic B (tenant-wide doctor, B's main branch assistant). */
async function invitedDoctor() {
  const doctor = await activeMember(world, clinicA, [{ role: 'doctor', branchId: null }]);
  const invited = await addMember(world.app, clinicB.owner.cookie, {
    name: 'د. سامر',
    phone: doctor.phone,
    roles: [
      { role: 'doctor', branchId: null },
      { role: 'assistant', branchId: clinicB.branchId },
    ],
  });
  expect(invited.res.statusCode).toBe(201);
  return { doctor, invited, token: tokenOf(invited.linkUrl) };
}

describe('viewing an invitation', () => {
  it('shows the clinic, the person, the roles with scope and only the masked phone', async () => {
    const { token } = await invitedDoctor();
    const res = await post(world.app, '/invitations/view', { token });
    expect(res.statusCode).toBe(200);
    const body = res.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      clinicName: expect.any(String) as unknown,
      personName: 'د. سامر',
      roles: expect.arrayContaining([
        { role: 'doctor', branchName: null },
        { role: 'assistant', branchName: expect.any(String) as unknown },
      ]) as unknown,
    });
    expect(JSON.stringify(body)).not.toMatch(/\+\d{8,}/);
    expect(body['phoneMasked']).toMatch(/^\+963 ••• ••• \d{3}$/);
  });

  it('answers link_invalid for a member setup link and for an unknown token', async () => {
    const added = await addMember(world.app, clinicB.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'receptionist', branchId: null }],
    });
    const setup = await post(world.app, '/invitations/view', { token: tokenOf(added.linkUrl) });
    expect(setup.statusCode).toBe(404);
    expect(errorCode(setup)).toBe('link_invalid');
    const unknown = await post(world.app, '/invitations/view', { token: 'A'.repeat(43) });
    expect(errorCode(unknown)).toBe('link_invalid');
  });
});

describe('accepting an invitation', () => {
  it('keeps the clinic out of the person’s clinics until accepted, then binds it', async () => {
    const { doctor, invited, token } = await invitedDoctor();
    // Pending: one active clinic, so sign-in goes straight into clinic A.
    expect((await signIn(world.app, doctor.phone, PASSWORD)).json()).toMatchObject({
      tenantId: clinicA.clinicId,
    });
    // Setting a password through an invitation is refused.
    const consume = await post(world.app, '/auth/setup-link/consume', {
      token,
      password: PASSWORD,
    });
    expect(consume.statusCode).toBe(409);

    const accepted = await post(world.app, '/invitations/accept', { token }, doctor.cookie);
    expect(accepted.statusCode).toBe(204);
    const [row] = await membershipRow(invited.membershipId);
    expect(row).toMatchObject({ status: 'active', userId: doctor.userId });
    // Two active clinics now: no clinic chosen at sign-in (chooser, A-01-05).
    expect((await signIn(world.app, doctor.phone, PASSWORD)).json()).toMatchObject({
      tenantId: null,
    });
    // The owner sees an active member.
    const detail = await get(
      world.app,
      `/team/members/${invited.membershipId}`,
      clinicB.owner.cookie,
    );
    expect(detail.json()).toMatchObject({ status: 'active' });
    // Used once.
    const twice = await post(world.app, '/invitations/accept', { token }, doctor.cookie);
    expect(errorCode(twice)).toBe('link_invalid');
  });

  it('refuses a person signed in with another phone (403 invitation_other_phone); nothing is bound', async () => {
    const { invited, token } = await invitedDoctor();
    const stranger = await activeMember(world, clinicA, [{ role: 'accountant', branchId: null }]);
    const res = await post(world.app, '/invitations/accept', { token }, stranger.cookie);
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('invitation_other_phone');
    const [row] = await membershipRow(invited.membershipId);
    expect(row).toMatchObject({ status: 'pending', userId: null });
  });

  it('needs a session (401)', async () => {
    const { token } = await invitedDoctor();
    expect((await post(world.app, '/invitations/accept', { token })).statusCode).toBe(401);
  });
});

describe('declining an invitation', () => {
  it('ends the invitation; the member stays pending for the owner', async () => {
    const { doctor, invited, token } = await invitedDoctor();
    const res = await post(world.app, '/invitations/decline', { token }, doctor.cookie);
    expect(res.statusCode).toBe(204);
    expect(errorCode(await post(world.app, '/invitations/view', { token }))).toBe('link_invalid');
    const accept = await post(world.app, '/invitations/accept', { token }, doctor.cookie);
    expect(errorCode(accept)).toBe('link_invalid');
    const [row] = await membershipRow(invited.membershipId);
    expect(row).toMatchObject({ status: 'pending', userId: null });
  });
});

// Last in the file: the clock only moves forward.
describe('an expired invitation', () => {
  it('is refused (link_invalid) after 72 h', async () => {
    const { doctor, token } = await invitedDoctor();
    expect((await post(world.app, '/invitations/view', { token })).statusCode).toBe(200);
    clock.advanceBy(73 * 3_600_000);
    expect(errorCode(await post(world.app, '/invitations/view', { token }))).toBe('link_invalid');
    // A fresh session (the old one ran out): the invitation is still not accepted.
    const cookie = sessionCookie(await signIn(world.app, doctor.phone, PASSWORD));
    const res = await post(world.app, '/invitations/accept', { token }, cookie);
    expect(errorCode(res)).toBe('link_invalid');
  });
});
