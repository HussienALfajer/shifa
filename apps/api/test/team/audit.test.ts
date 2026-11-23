// A-01b criterion 12: one audit row per team event, in the clinic's tenant, with the acting
// person, the member as target and the request id; never a phone, a name or a token.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  addMember,
  auditRowsOf,
  type Clinic,
  patch,
  post,
  type TeamWorld,
  teamWorld,
  tenantAuditRows,
  tokenOf,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let ownerUserId: string;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_05);
  clinic = await world.clinic();
  const session = await world.app.app.inject({
    method: 'GET',
    url: '/auth/session',
    headers: { cookie: clinic.owner.cookie },
  });
  ownerUserId = session.json<{ userId: string }>().userId;
});

afterAll(async () => {
  await world.app.app.close();
});

async function rowsOf(event: string, targetId: string) {
  return (await tenantAuditRows(clinic.clinicId)).filter(
    (r) => r.event === event && r.targetId === targetId,
  );
}

describe('team audit rows', () => {
  it('writes exactly one row per event, without phones, names or tokens', async () => {
    const member = await activeMember(world, clinic, [{ role: 'assistant', branchId: null }]);
    const id = member.membershipId;
    const url = `/team/members/${id}`;
    await patch(
      world.app,
      url,
      { roles: [{ role: 'doctor', branchId: null }] },
      clinic.owner.cookie,
    );
    await patch(
      world.app,
      url,
      { permissions: [{ key: 'clinical.notes.view', granted: false }] },
      clinic.owner.cookie,
    );
    await post(world.app, `${url}/deactivate`, {}, clinic.owner.cookie);
    await post(world.app, `${url}/reactivate`, {}, clinic.owner.cookie);
    await post(world.app, `${url}/setup-link`, {}, clinic.owner.cookie);

    for (const event of [
      'member.added',
      'member.roles_changed',
      'member.permissions_changed',
      'member.deactivated',
      'member.reactivated',
      'member.link_issued',
    ]) {
      const rows = await rowsOf(event, id);
      expect(rows, event).toHaveLength(1);
      expect(rows[0], event).toMatchObject({
        tenantId: clinic.clinicId,
        actorId: ownerUserId,
        requestId: expect.any(String) as unknown,
      });
    }
    expect((await rowsOf('member.permissions_changed', id))[0]?.data).toEqual({
      key: 'clinical.notes.view',
      granted: false,
    });
    const all = JSON.stringify(await tenantAuditRows(clinic.clinicId));
    expect(all).not.toContain(member.phone);
    expect(all).not.toContain(member.phone.slice(4));
    expect(all).not.toContain('موظف تجريبي');
    expect(all).not.toMatch(/[A-Za-z0-9_-]{43}/);
  });

  it('records an accepted and a declined invitation in the inviting clinic', async () => {
    const other = await world.clinic();
    const doctor = await activeMember(world, other, [{ role: 'doctor', branchId: null }]);
    const roles = [{ role: 'doctor' as const, branchId: null }];
    const first = await addMember(world.app, clinic.owner.cookie, { phone: doctor.phone, roles });
    await post(world.app, '/invitations/decline', { token: tokenOf(first.linkUrl) }, doctor.cookie);
    const again = await post(
      world.app,
      `/team/members/${first.membershipId}/setup-link`,
      {},
      clinic.owner.cookie,
    );
    await post(
      world.app,
      '/invitations/accept',
      { token: tokenOf(again.json<{ url: string }>().url) },
      doctor.cookie,
    );
    for (const event of ['member.invitation_declined', 'member.invitation_accepted']) {
      const rows = await rowsOf(event, first.membershipId);
      expect(rows, event).toHaveLength(1);
      expect(rows[0], event).toMatchObject({ tenantId: clinic.clinicId, actorId: doctor.userId });
    }
    // Nothing about clinic B reaches clinic A's log, and the platform log has no team rows.
    expect((await auditRowsOf('member.%')).every((r) => r.tenantId !== null)).toBe(true);
    expect(JSON.stringify(await tenantAuditRows(clinic.clinicId))).not.toContain(doctor.phone);
  });
});
