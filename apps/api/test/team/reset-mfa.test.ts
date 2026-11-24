// A-01b criterion 3 (A-01-09, OD-95): the owner resets a member's TOTP: the member's sessions
// end, the next sign-in is at `mfa: none` (enrol again from My account), audited in the clinic
// (`member.mfa_reset`) and on the auth path (`auth.mfa_reset`). Never an owner's (the super admin
// resets those: `owner_mfa_platform`, the owner's own account too); a member without TOTP or
// without an account → `mfa_not_enrolled`; a shared account → its sessions here end, then
// `account_shared`, TOTP kept; another clinic's member → 404; a receptionist → 403.
import { twoFactor } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, sessionCookie, signIn, testClock } from '../identity/support.ts';
import { STEP_MS, totpAt } from '../identity/totp.ts';
import { enrolTotp, platformAuditRows } from '../platform/support.ts';
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
  tokenOf,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_11_30);
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

const reset = (id: string, cookie: string = clinic.owner.cookie) =>
  post(world.app, `/team/members/${id}/reset-mfa`, {}, cookie);

/** An active doctor with TOTP enrolled; the clock past the enrolment step. */
async function enrolledDoctor(target: Clinic = clinic) {
  const m = await activeMember(world, target, [{ role: 'doctor', branchId: null }]);
  const enrolled = await enrolTotp(world.app, m.cookie, clock);
  clock.advanceBy(2 * STEP_MS);
  return { ...m, cookie: enrolled.cookie };
}

describe('the owner resets a member’s TOTP (criterion 3, OD-95)', () => {
  it('the drawer shows mfaEnrolled; reset ends the sessions, next sign-in at mfa none, audited', async () => {
    const m = await enrolledDoctor();
    const before = await get(world.app, `/team/members/${m.membershipId}`, clinic.owner.cookie);
    expect(before.json()).toMatchObject({ mfaEnrolled: true });

    const res = await reset(m.membershipId);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ id: m.membershipId, mfaEnrolled: false });
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(401);
    const again = await signIn(world.app, m.phone, PASSWORD);
    expect(again.json()).toMatchObject({ mfa: 'none', mfaRequired: false });
    // Staff may enrol again from My account.
    expect(
      (await post(world.app, '/auth/mfa/enrol/start', undefined, sessionCookie(again))).statusCode,
    ).toBe(200);

    const clinicRows = (await tenantAuditRows(clinic.clinicId)).filter(
      (r) => r.event === 'member.mfa_reset',
    );
    expect(clinicRows).toEqual([expect.objectContaining({ targetId: m.membershipId })]);
    const authRows = (await platformAuditRows()).filter(
      (r) => r.event === 'auth.mfa_reset' && r.targetId === m.userId,
    );
    expect(authRows).toHaveLength(1);
    expect(JSON.stringify([...clinicRows, ...authRows])).not.toContain(m.phone);
  });

  it('the caller’s own → 409 self_action; another owner’s → 409 owner_mfa_platform', async () => {
    const own = await reset(clinic.ownerMembershipId);
    expect(own.statusCode).toBe(409);
    expect(errorCode(own)).toBe('self_action');
    expect((await get(world.app, '/auth/session', clinic.owner.cookie)).statusCode).toBe(200);
    const other = await world.clinic();
    const second = await activeMember(world, other, [{ role: 'owner', branchId: null }]);
    const res = await post(
      world.app,
      `/team/members/${second.membershipId}/reset-mfa`,
      {},
      other.owner.cookie,
    );
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('owner_mfa_platform');
  });

  it('a member without TOTP, or pending without an account → 409 mfa_not_enrolled', async () => {
    const m = await activeMember(world, clinic, [{ role: 'assistant', branchId: null }]);
    expect(errorCode(await reset(m.membershipId))).toBe('mfa_not_enrolled');
    const pending = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'doctor', branchId: null }],
    });
    const res = await reset(pending.membershipId);
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('mfa_not_enrolled');
  });

  it('a shared account: its sessions here end, then 409 account_shared; TOTP kept', async () => {
    const m = await enrolledDoctor();
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
    // The session must be in this clinic to be ended by it.
    expect(
      (await post(world.app, '/me/switch', { tenantId: clinic.clinicId }, m.cookie)).statusCode,
    ).toBe(200);

    const res = await reset(m.membershipId);
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('account_shared');
    expect((await get(world.app, '/auth/session', m.cookie)).statusCode).toBe(401);
    expect((await signIn(world.app, m.phone, PASSWORD)).json()).toMatchObject({ mfa: 'pending' });
  });

  it('another clinic’s member → 404; a receptionist → 403', async () => {
    const other = await world.clinic();
    const foreign = await enrolledDoctor(other);
    expect((await reset(foreign.membershipId)).statusCode).toBe(404);
    expect((await signIn(world.app, foreign.phone, PASSWORD)).json()).toMatchObject({
      mfa: 'pending',
    });

    const receptionist = await activeMember(world, clinic, [
      { role: 'receptionist', branchId: null },
    ]);
    const target = await enrolledDoctor();
    expect((await reset(target.membershipId, receptionist.cookie)).statusCode).toBe(403);
  });
});

describe('a reset during a pending re-enrolment (A-01a 11, OD-98, A-01-11)', () => {
  it('removes the old and the pending secret', async () => {
    const m = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const enrolled = await enrolTotp(world.app, m.cookie, clock);
    clock.advanceBy(2 * STEP_MS);
    const start = await post(
      world.app,
      '/auth/mfa/re-enrol/start',
      { code: totpAt(enrolled.manualKey, clock.now()) },
      enrolled.cookie,
    );
    expect(start.statusCode, start.body).toBe(200);
    expect((await reset(m.membershipId)).statusCode).toBe(200);
    const rows = await superuserDb(workerDatabaseName())
      .select({ id: twoFactor.id })
      .from(twoFactor)
      .where(eq(twoFactor.userId, m.userId));
    expect(rows).toEqual([]);
  });
});
