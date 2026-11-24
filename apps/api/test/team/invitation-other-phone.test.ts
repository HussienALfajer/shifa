// A-01b criterion 2, OD-104 (A-01-12): a person signed in with another number who opens a valid
// invitation is told so (403 `invitation_other_phone`); nothing is written and the invited person
// still accepts the same link. A used, replaced or expired link keeps the one answer for anyone
// (404 `link_invalid`), and a super admin always gets `link_invalid`.
import { setupLink } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  addMember,
  auditRowsOf,
  type Clinic,
  errorCode,
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
  world = await teamWorld(clock, 2026_12_13);
  clinicA = await world.clinic();
  clinicB = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

/** A doctor of clinic A invited to clinic B, and a stranger signed in with another number. */
async function invitation() {
  const doctor = await activeMember(world, clinicA, [{ role: 'doctor', branchId: null }]);
  const stranger = await activeMember(world, clinicA, [{ role: 'accountant', branchId: null }]);
  const invited = await addMember(world.app, clinicB.owner.cookie, {
    phone: doctor.phone,
    roles: [{ role: 'doctor', branchId: null }],
  });
  expect(invited.res.statusCode).toBe(201);
  return { doctor, stranger, invited, token: tokenOf(invited.linkUrl) };
}

describe('a valid invitation opened with another number (OD-104)', () => {
  it('accept and decline → 403 invitation_other_phone; nothing written; the invited person accepts', async () => {
    const { doctor, stranger, invited, token } = await invitation();
    const accepted = (await auditRowsOf('member.invitation_%')).length;
    const used = (await auditRowsOf('auth.link_used')).length;
    for (const action of ['accept', 'decline']) {
      const res = await post(world.app, `/invitations/${action}`, { token }, stranger.cookie);
      expect([res.statusCode, errorCode(res)], action).toEqual([403, 'invitation_other_phone']);
    }
    const [row] = await membershipRow(invited.membershipId);
    expect(row).toMatchObject({ status: 'pending', userId: null });
    expect((await auditRowsOf('member.invitation_%')).length).toBe(accepted);
    expect((await auditRowsOf('auth.link_used')).length).toBe(used);
    const [link] = await superuserDb(workerDatabaseName())
      .select({ usedAt: setupLink.usedAt })
      .from(setupLink)
      .where(eq(setupLink.membershipId, invited.membershipId));
    expect(link?.usedAt).toBeNull();

    const res = await post(world.app, '/invitations/accept', { token }, doctor.cookie);
    expect(res.statusCode, res.body).toBe(204);
  });

  it('the answer says nothing about the person or the phone', async () => {
    const { stranger, doctor, token } = await invitation();
    const res = await post(world.app, '/invitations/accept', { token }, stranger.cookie);
    expect(res.body).not.toContain(doctor.phone);
    expect(res.body).not.toContain(stranger.phone);
    expect(res.body).not.toContain(doctor.phone.slice(-3));
  });
});

describe('a dead link keeps link_invalid for another number', () => {
  it('a used link', async () => {
    const { doctor, stranger, token } = await invitation();
    expect(
      (await post(world.app, '/invitations/accept', { token }, doctor.cookie)).statusCode,
    ).toBe(204);
    // Bound: the invitation is no longer one.
    const res = await post(world.app, '/invitations/accept', { token }, stranger.cookie);
    expect([res.statusCode, errorCode(res)]).toEqual([404, 'link_invalid']);
  });

  it('a declined link', async () => {
    const { doctor, stranger, token } = await invitation();
    expect(
      (await post(world.app, '/invitations/decline', { token }, doctor.cookie)).statusCode,
    ).toBe(204);
    const res = await post(world.app, '/invitations/accept', { token }, stranger.cookie);
    expect([res.statusCode, errorCode(res)]).toEqual([404, 'link_invalid']);
  });

  it('a replaced link', async () => {
    const { stranger, invited, token } = await invitation();
    const again = await post(
      world.app,
      `/team/members/${invited.membershipId}/setup-link`,
      {},
      clinicB.owner.cookie,
    );
    expect(again.statusCode).toBe(200);
    const res = await post(world.app, '/invitations/decline', { token }, stranger.cookie);
    expect([res.statusCode, errorCode(res)]).toEqual([404, 'link_invalid']);
  });

  it('an expired link', async () => {
    const { stranger, invited, token } = await invitation();
    await superuserDb(workerDatabaseName())
      .update(setupLink)
      .set({ expiresAt: new Date(clock.now().getTime() - 1000) })
      .where(eq(setupLink.membershipId, invited.membershipId));
    const res = await post(world.app, '/invitations/accept', { token }, stranger.cookie);
    expect([res.statusCode, errorCode(res)]).toEqual([404, 'link_invalid']);
  });
});

describe('a super admin', () => {
  it('gets link_invalid for a valid invitation to another number', async () => {
    const { token } = await invitation();
    const res = await post(world.app, '/invitations/accept', { token }, world.admin.cookie);
    expect([res.statusCode, errorCode(res)]).toEqual([404, 'link_invalid']);
  });
});
