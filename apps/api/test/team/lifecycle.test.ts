// A-01b criteria 3, 4, 5 and OD-86: deactivating and reactivating a member, a new link (staff
// recovery) ending the member's sessions, the last-owner refusal for removing, demoting and
// deactivating, and a member's sessions ending at the next request when deactivated or left
// without a role. A new link resets the password of an account that belongs to this clinic
// alone; a shared account is refused (409 `account_shared`) and its sessions here still end.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, signIn, testClock } from '../identity/support.ts';
import {
  activeMember,
  addMember,
  type Clinic,
  errorCode,
  get,
  membershipRow,
  patch,
  post,
  sessionsOf,
  type TeamWorld,
  teamWorld,
  tokenOf,
  useMemberLink,
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

const member = (id: string, action = '') => `/team/members/${id}${action}`;

describe('deactivation and reactivation', () => {
  it('ends the member’s sessions at once (401 on the next request) and reactivates', async () => {
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(200);

    const off = await post(
      world.app,
      member(m.membershipId, '/deactivate'),
      {},
      clinic.owner.cookie,
    );
    expect(off.statusCode).toBe(200);
    expect(off.json()).toMatchObject({ status: 'deactivated' });
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(401);
    expect(await sessionsOf(m.userId)).toEqual([]);

    // Signing in again gives no clinic.
    const again = await signIn(world.app, m.phone, PASSWORD);
    expect(again.json()).toMatchObject({ tenantId: null, roles: [] });

    const on = await post(
      world.app,
      member(m.membershipId, '/reactivate'),
      {},
      clinic.owner.cookie,
    );
    expect(on.json()).toMatchObject({ status: 'active' });
    const back = await signIn(world.app, m.phone, PASSWORD);
    expect(back.json()).toMatchObject({ tenantId: clinic.clinicId });
  });

  it('ends the member’s sessions when their last role is removed', async () => {
    const m = await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]);
    const res = await patch(world.app, member(m.membershipId), { roles: [] }, clinic.owner.cookie);
    expect(res.statusCode).toBe(200);
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(401);
  });

  it('refuses reactivating a member who is not deactivated (409 member_not_deactivated)', async () => {
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const res = await post(
      world.app,
      member(m.membershipId, '/reactivate'),
      {},
      clinic.owner.cookie,
    );
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('member_not_deactivated');
  });
});

describe('a new link (staff recovery)', () => {
  it('replaces a pending member’s link: the earlier one stops working', async () => {
    const added = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'assistant', branchId: null }],
    });
    const again = await post(
      world.app,
      member(added.membershipId, '/setup-link'),
      {},
      clinic.owner.cookie,
    );
    expect(again.statusCode).toBe(200);
    expect(again.json()).not.toHaveProperty('purpose');
    const old = await post(world.app, '/auth/setup-link/view', { token: tokenOf(added.linkUrl) });
    expect(errorCode(old)).toBe('link_invalid');
    await useMemberLink(world.app, again.json<{ url: string }>().url);
  });

  it('ends an active member’s sessions and resets the password of a one-clinic account', async () => {
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const res = await post(
      world.app,
      member(m.membershipId, '/setup-link'),
      {},
      clinic.owner.cookie,
    );
    expect(res.statusCode).toBe(200);
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(401);
    // The old password stops at once; the link sets the next one.
    expect((await signIn(world.app, m.phone, PASSWORD)).statusCode).toBe(401);
    const cookie = await useMemberLink(world.app, res.json<{ url: string }>().url);
    expect((await get(world.app, '/auth/session', cookie)).json()).toMatchObject({
      tenantId: clinic.clinicId,
      mfa: 'none',
    });
  });

  it('refuses a shared account (409 account_shared) and still ends its sessions here', async () => {
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    // The same person accepts a second clinic's invitation.
    const other = await world.clinic();
    const invited = await addMember(world.app, other.owner.cookie, {
      phone: m.phone,
      roles: [{ role: 'doctor', branchId: null }],
    });
    const accepted = await post(
      world.app,
      '/invitations/accept',
      { token: tokenOf(invited.linkUrl) },
      m.cookie,
    );
    expect(accepted.statusCode).toBe(204);

    const res = await post(
      world.app,
      member(m.membershipId, '/setup-link'),
      {},
      clinic.owner.cookie,
    );
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('account_shared');
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(401);
    // The password was not reset.
    expect((await signIn(world.app, m.phone, PASSWORD)).statusCode).toBe(200);
  });
});

describe('the last owner', () => {
  it('cannot be removed or demoted (409 last_owner), nor deactivate themselves (409 self_action); nothing changes', async () => {
    const url = member(clinic.ownerMembershipId);
    const removed = await patch(world.app, url, { roles: [] }, clinic.owner.cookie);
    expect(removed.statusCode).toBe(409);
    expect(errorCode(removed)).toBe('last_owner');

    const demoted = await patch(
      world.app,
      url,
      { roles: [{ role: 'doctor', branchId: null }] },
      clinic.owner.cookie,
    );
    expect(errorCode(demoted)).toBe('last_owner');

    // Deactivating oneself is refused before the last-owner rule (A-01-12, gap 7).
    const deactivated = await post(world.app, `${url}/deactivate`, {}, clinic.owner.cookie);
    expect(errorCode(deactivated)).toBe('self_action');

    const [row] = await membershipRow(clinic.ownerMembershipId);
    expect(row?.status).toBe('active');
    expect((await get(world.app, url, clinic.owner.cookie)).json()).toMatchObject({
      roles: [{ role: 'owner', branchId: null }],
      isLastOwner: true,
    });
  });

  it('can step down from the owner role once a second owner is active', async () => {
    const own = await world.clinic();
    const second = await activeMember(world, own, [{ role: 'owner', branchId: null }]);
    const res = await patch(
      world.app,
      member(own.ownerMembershipId),
      { roles: [{ role: 'doctor', branchId: null }] },
      own.owner.cookie,
    );
    expect(res.statusCode).toBe(200);
    // No longer an owner: the team routes are refused on the next request.
    const last = await post(
      world.app,
      member(second.membershipId, '/deactivate'),
      {},
      own.owner.cookie,
    );
    expect(last.statusCode).toBe(403);
  });

  it('a pending owner does not keep the clinic owned', async () => {
    const own = await world.clinic();
    await addMember(world.app, own.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'owner', branchId: null }],
    });
    const res = await patch(
      world.app,
      member(own.ownerMembershipId),
      { roles: [{ role: 'doctor', branchId: null }] },
      own.owner.cookie,
    );
    expect(errorCode(res)).toBe('last_owner');
  });
});
