// A-01b criteria 10, 11, 12 (A-01-05): the clinic chooser and switcher. A doctor in two clinics
// accepts the second clinic's invitation from the chooser (OD-90), sees both clinics last used
// first with role, last activity and the branches they hold a role in, switches clinic and
// branch (checked on the server, audited), and is refused a branch they hold no role in. A
// suspended clinic is listed but not selectable, cannot be switched to, and its signed-in
// members get 403 `clinic_suspended` on their next tenant request; `/me/*` and sign-out still
// work and the data stays. A deactivated membership never shows; nothing at all → 404 `no_clinic`.
import { membership } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { patch as adminPatch } from '../platform/support.ts';
import {
  activeMember,
  addBranch,
  addMember,
  type Clinic,
  errorCode,
  get,
  post,
  type TeamWorld,
  teamWorld,
  tenantAuditRows,
  tokenOf,
  useMemberLink,
} from '../team/support.ts';
import { PASSWORD, sessionCookie, signIn, testClock } from './support.ts';

const clock = testClock();
let world: TeamWorld;

interface MyClinic {
  tenantId: string;
  name: string;
  status: string;
  selectable: boolean;
  roles: string[];
  lastActiveAt: string | null;
  solo: boolean;
  branches: { id: string; name: string }[];
}
interface MyInvitation {
  id: string;
  clinicName: string;
  roles: { role: string; branchName: string | null }[];
  expiresAt: string;
}
interface MyClinics {
  clinics: MyClinic[];
  invitations: MyInvitation[];
}

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_07);
});

afterAll(async () => {
  await world.app.app.close();
});

const myClinics = async (cookie: string) => {
  const res = await get(world.app, '/me/clinics', cookie);
  expect(res.statusCode, res.body).toBe(200);
  return res.json<MyClinics>();
};
const switchTo = (cookie: string, tenantId: string, branchId?: string | null) =>
  post(
    world.app,
    '/me/switch',
    branchId === undefined ? { tenantId } : { tenantId, branchId },
    cookie,
  );
const sessionOf = async (cookie: string) =>
  (await get(world.app, '/auth/session', cookie)).json<{
    tenantId: string | null;
    branchId: string | null;
    roles: { role: string; branchId: string | null }[];
  }>();

/** A doctor of clinic `a` (tenant-wide), invited by `b` to its branch `bBranch`. */
async function doctorInvitedByB(a: Clinic, b: Clinic, bBranch: string) {
  const doctor = await activeMember(world, a, [{ role: 'doctor', branchId: null }]);
  const invited = await addMember(world.app, b.owner.cookie, {
    phone: doctor.phone,
    roles: [{ role: 'doctor', branchId: bBranch }],
  });
  expect(invited.res.statusCode).toBe(201);
  return { ...doctor, invitation: invited };
}

describe('a doctor in two clinics (journey)', () => {
  it('accepts from the chooser, lists, switches clinic and branch, is refused, then suspended', async () => {
    const a = await world.clinic();
    const b = await world.clinic();
    const bSecond = await addBranch(b.clinicId, 'فرع الجميلية');
    const doctor = await doctorInvitedByB(a, b, bSecond);

    // The chooser lists the pending invitation (clinic name and roles only) next to clinic A.
    const before = await myClinics(doctor.cookie);
    expect(before.clinics.map((c) => c.tenantId)).toEqual([a.clinicId]);
    expect(before.invitations).toEqual([
      {
        id: doctor.invitation.membershipId,
        clinicName: expect.any(String),
        roles: [{ role: 'doctor', branchName: 'فرع الجميلية' }],
        expiresAt: expect.any(String),
      },
    ]);
    const accepted = await post(
      world.app,
      `/me/invitations/${doctor.invitation.membershipId}/accept`,
      {},
      doctor.cookie,
    );
    expect(accepted.statusCode, accepted.body).toBe(204);
    // The clinic's link is closed: the link path answers link_invalid now.
    const viaLink = await post(world.app, '/invitations/view', {
      token: tokenOf(doctor.invitation.linkUrl),
    });
    expect(errorCode(viaLink)).toBe('link_invalid');

    // Last used first: A (where the doctor has been active), then B; branches per role.
    const both = await myClinics(doctor.cookie);
    expect(both.invitations).toEqual([]);
    expect(both.clinics.map((c) => c.tenantId)).toEqual([a.clinicId, b.clinicId]);
    expect(both.clinics[0]).toMatchObject({
      status: 'trial',
      selectable: true,
      roles: ['doctor'],
      solo: true,
      branches: [{ id: a.branchId }],
    });
    expect(both.clinics[0]?.lastActiveAt).not.toBeNull();
    expect(both.clinics[1]).toMatchObject({
      selectable: true,
      roles: ['doctor'],
      solo: false,
      lastActiveAt: null,
      branches: [{ id: bSecond, name: 'فرع الجميلية' }],
    });

    // Signing in again with two clinics leaves the choice to the chooser.
    const cookie = sessionCookie(await signIn(world.app, doctor.phone, PASSWORD));
    expect(await sessionOf(cookie)).toMatchObject({ tenantId: null, branchId: null });

    // Switch to B: the one branch held there is chosen; the token stays.
    const toB = await switchTo(cookie, b.clinicId);
    expect(toB.statusCode, toB.body).toBe(200);
    expect(toB.json()).toEqual({ tenantId: b.clinicId, branchId: bSecond });
    expect(await sessionOf(cookie)).toMatchObject({
      tenantId: b.clinicId,
      branchId: bSecond,
      roles: [{ role: 'doctor', branchId: bSecond }],
    });
    // A branch of B the doctor holds no role in: refused, even called directly.
    const unheld = await switchTo(cookie, b.clinicId, b.branchId);
    expect([unheld.statusCode, errorCode(unheld)]).toEqual([403, 'branch_not_held']);
    expect(await sessionOf(cookie)).toMatchObject({ tenantId: b.clinicId, branchId: bSecond });

    // Back to A, explicitly to its branch (tenant-wide role).
    const toA = await switchTo(cookie, a.clinicId, a.branchId);
    expect(toA.json()).toEqual({ tenantId: a.clinicId, branchId: a.branchId });

    // One clinic.switched row per switch, in the clinic switched to (criterion 12).
    const switched = async (tenantId: string) =>
      (await tenantAuditRows(tenantId))
        .filter((r) => r.event === 'clinic.switched')
        .map((r) => r.actorId);
    expect(await switched(b.clinicId)).toEqual([doctor.userId]);
    expect(await switched(a.clinicId)).toEqual([doctor.userId]);

    // B suspended: listed, not selectable, no branches; switching to it refused.
    const suspend = await adminPatch(
      world.app,
      `/platform/clinics/${b.clinicId}`,
      { status: 'suspended' },
      world.admin.cookie,
    );
    expect(suspend.statusCode, suspend.body).toBe(200);
    const after = await myClinics(cookie);
    expect(after.clinics.find((c) => c.tenantId === b.clinicId)).toMatchObject({
      status: 'suspended',
      selectable: false,
      branches: [],
    });
    const refused = await switchTo(cookie, b.clinicId);
    expect([refused.statusCode, errorCode(refused)]).toEqual([403, 'clinic_suspended']);
  });
});

describe('a suspended clinic (criterion 11)', () => {
  it('its signed-in owner gets 403 clinic_suspended on the next request; /me and sign-out work', async () => {
    const c = await world.clinic();
    expect((await get(world.app, '/team/members', c.owner.cookie)).statusCode).toBe(200);
    const members = async () =>
      superuserDb(workerDatabaseName())
        .select()
        .from(membership)
        .where(eq(membership.tenantId, c.clinicId));
    const kept = (await members()).length;

    await adminPatch(
      world.app,
      `/platform/clinics/${c.clinicId}`,
      { status: 'suspended' },
      world.admin.cookie,
    );
    const denied = await get(world.app, '/team/members', c.owner.cookie);
    expect([denied.statusCode, errorCode(denied)]).toEqual([403, 'clinic_suspended']);
    const listed = await myClinics(c.owner.cookie);
    expect(listed.clinics).toMatchObject([{ tenantId: c.clinicId, selectable: false }]);
    expect((await members()).length).toBe(kept);
    expect((await post(world.app, '/auth/sign-out', {}, c.owner.cookie)).statusCode).toBe(204);

    // Reactivated: the owner signs in straight into the clinic again.
    await adminPatch(
      world.app,
      `/platform/clinics/${c.clinicId}`,
      { status: 'active' },
      world.admin.cookie,
    );
    expect((await members()).length).toBe(kept);
  });

  it('a member of one active and one suspended clinic signs in straight into the active one', async () => {
    const a = await world.clinic();
    const b = await world.clinic();
    const doctor = await doctorInvitedByB(a, b, b.branchId);
    await post(
      world.app,
      `/me/invitations/${doctor.invitation.membershipId}/accept`,
      {},
      doctor.cookie,
    );
    await adminPatch(
      world.app,
      `/platform/clinics/${b.clinicId}`,
      { status: 'suspended' },
      world.admin.cookie,
    );
    const res = await signIn(world.app, doctor.phone, PASSWORD);
    expect(res.json()).toMatchObject({ tenantId: a.clinicId, branchId: a.branchId });
  });
});

describe('refused switches (criteria 10, 11)', () => {
  it('another person’s clinic, a deactivated membership, an archived branch', async () => {
    const a = await world.clinic();
    const b = await world.clinic();
    const doctor = await activeMember(world, a, [{ role: 'doctor', branchId: null }]);

    const foreign = await switchTo(doctor.cookie, b.clinicId);
    expect(foreign.statusCode).toBe(404);

    const second = await addBranch(a.clinicId, 'فرع للأرشفة');
    const archived = await post(world.app, `/branches/${second}/archive`, {}, a.owner.cookie);
    expect(archived.statusCode).toBe(200);
    const toArchived = await switchTo(doctor.cookie, a.clinicId, second);
    expect([toArchived.statusCode, errorCode(toArchived)]).toEqual([409, 'branch_archived']);
    // Nor is it listed.
    const listed = await myClinics(doctor.cookie);
    expect(listed.clinics[0]?.branches.map((br) => br.id)).toEqual([a.branchId]);

    const off = await post(
      world.app,
      `/team/members/${doctor.membershipId}/deactivate`,
      {},
      a.owner.cookie,
    );
    expect(off.statusCode).toBe(200);
    const again = sessionCookie(await signIn(world.app, doctor.phone, PASSWORD));
    const inactive = await switchTo(again, a.clinicId);
    expect(inactive.statusCode).toBe(404);
    // A deactivated membership never shows in the chooser; nothing else → no_clinic.
    const none = await get(world.app, '/me/clinics', again);
    expect([none.statusCode, errorCode(none)]).toEqual([404, 'no_clinic']);
  });
});

describe('invitations by id (OD-90)', () => {
  it('declining removes it from the chooser and closes the link', async () => {
    const a = await world.clinic();
    const b = await world.clinic();
    const doctor = await doctorInvitedByB(a, b, b.branchId);
    const res = await post(
      world.app,
      `/me/invitations/${doctor.invitation.membershipId}/decline`,
      {},
      doctor.cookie,
    );
    expect(res.statusCode).toBe(204);
    expect((await myClinics(doctor.cookie)).invitations).toEqual([]);
    const viaLink = await post(
      world.app,
      '/invitations/accept',
      {
        token: tokenOf(doctor.invitation.linkUrl),
      },
      doctor.cookie,
    );
    expect(errorCode(viaLink)).toBe('link_invalid');
    const rows = (await tenantAuditRows(b.clinicId)).filter((r) =>
      r.event.startsWith('member.invitation'),
    );
    expect(rows.map((r) => [r.event, r.targetId, r.actorId])).toEqual([
      ['member.invitation_declined', doctor.invitation.membershipId, doctor.userId],
    ]);
  });

  it('someone else’s invitation, or an unknown id, answers 404 link_invalid', async () => {
    const a = await world.clinic();
    const b = await world.clinic();
    const doctor = await doctorInvitedByB(a, b, b.branchId);
    const stranger = await activeMember(world, a, [{ role: 'receptionist', branchId: null }]);
    for (const id of [doctor.invitation.membershipId, a.ownerMembershipId]) {
      for (const action of ['accept', 'decline']) {
        const res = await post(world.app, `/me/invitations/${id}/${action}`, {}, stranger.cookie);
        expect([res.statusCode, errorCode(res)]).toEqual([404, 'link_invalid']);
      }
    }
    expect((await myClinics(doctor.cookie)).invitations).toHaveLength(1);
  });

  it('a new phone’s member link is no invitation: it never shows in a chooser', async () => {
    const a = await world.clinic();
    const phone = world.phone();
    const added = await addMember(world.app, a.owner.cookie, {
      phone,
      roles: [{ role: 'assistant', branchId: null }],
    });
    const cookie = await useMemberLink(world.app, added.linkUrl);
    const listed = await myClinics(cookie);
    expect(listed.invitations).toEqual([]);
    expect(listed.clinics.map((c) => c.tenantId)).toEqual([a.clinicId]);
  });
});
