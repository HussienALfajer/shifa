// A-01b criteria 2, 3, 6, 7: the owner adds members with roles per clinic or branch and gets a
// setup link whose view is identical for a new phone and a phone with an account; the team list
// and member detail; roles and sensitive toggles edited; an override for a non-sensitive or an
// unknown key refused; a phone already in the team refused.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedPerson, testClock } from '../identity/support.ts';
import { CLINIC_WEB_URL } from '../platform/support.ts';
import {
  activeMember,
  addBranch,
  addMember,
  type Clinic,
  errorCode,
  get,
  membershipRow,
  patch,
  type TeamWorld,
  teamWorld,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_01);
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

/** The owner's view with the values that differ per person blanked. */
function shape(body: Record<string, unknown>): unknown {
  return JSON.parse(
    JSON.stringify(body)
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
      .replace(/\+\d{8,15}/g, '<phone>')
      .replace(/#[A-Za-z0-9_-]{43}/g, '#<token>')
      .replace(/%23[A-Za-z0-9_-]{43}/g, '%23<token>')
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '<time>'),
  ) as unknown;
}

describe('adding a member', () => {
  it('gives a setup link and a pending member', async () => {
    const phone = world.phone();
    const added = await addMember(world.app, clinic.owner.cookie, {
      name: 'ريم الاستقبال',
      phone,
      roles: [{ role: 'receptionist', branchId: clinic.branchId }],
    });
    expect(added.res.statusCode).toBe(201);
    const body = added.res.json<{
      member: Record<string, unknown>;
      link: Record<string, unknown>;
    }>();
    expect(body.member).toMatchObject({
      name: 'ريم الاستقبال',
      phone,
      status: 'pending',
      roles: [{ role: 'receptionist', branchId: clinic.branchId }],
    });
    expect(String(body.link['url'])).toMatch(new RegExp(`^${CLINIC_WEB_URL}/setup#`));
    expect(String(body.link['whatsappUrl'])).toMatch(/^https:\/\/wa\.me\/\?text=/);
    // The purpose would tell whether the phone has an account (criterion 2).
    expect(body.link).not.toHaveProperty('purpose');
    const [row] = await membershipRow(added.membershipId);
    expect(row).toMatchObject({ tenantId: clinic.clinicId, status: 'pending', userId: null });
  });

  it('shows the owner the same thing for a new phone and a phone with an account', async () => {
    const existing = await seedPerson(world.phone());
    const fresh = world.phone();
    const roles = [{ role: 'doctor' as const, branchId: null }];
    const a = await addMember(world.app, clinic.owner.cookie, { phone: fresh, roles });
    const b = await addMember(world.app, clinic.owner.cookie, { phone: existing.phone, roles });
    expect(a.res.statusCode).toBe(201);
    expect(b.res.statusCode).toBe(201);
    expect(shape(a.res.json())).toEqual(shape(b.res.json()));
    const detailA = await get(world.app, `/team/members/${a.membershipId}`, clinic.owner.cookie);
    const detailB = await get(world.app, `/team/members/${b.membershipId}`, clinic.owner.cookie);
    expect(shape(detailA.json())).toEqual(shape(detailB.json()));
    // The account's own data never reaches the owner: the name is what the owner typed.
    expect(detailB.json()).toMatchObject({ name: 'موظف تجريبي', status: 'pending' });
  });

  it('accepts several role assignments, tenant-wide and per branch', async () => {
    const second = await addBranch(clinic.clinicId);
    const added = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [
        { role: 'doctor', branchId: second },
        { role: 'assistant', branchId: null },
      ],
    });
    expect(added.res.statusCode).toBe(201);
    const detail = await get(world.app, `/team/members/${added.membershipId}`, clinic.owner.cookie);
    expect(detail.json<{ roles: unknown[] }>().roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'doctor', branchId: second, branchName: 'فرع الجميلية' }),
        expect.objectContaining({ role: 'assistant', branchId: null, branchName: null }),
      ]),
    );
  });

  it('refuses a phone already in the team (409 phone_in_team), whatever its spelling', async () => {
    const phone = world.phone();
    const roles = [{ role: 'accountant' as const, branchId: null }];
    expect((await addMember(world.app, clinic.owner.cookie, { phone, roles })).res.statusCode).toBe(
      201,
    );
    const again = await addMember(world.app, clinic.owner.cookie, {
      phone: phone.replace('+963', '0'),
      roles,
    });
    expect(again.res.statusCode).toBe(409);
    expect(errorCode(again.res)).toBe('phone_in_team');
    const owner = await addMember(world.app, clinic.owner.cookie, {
      phone: clinic.ownerPhone,
      roles,
    });
    expect(errorCode(owner.res)).toBe('phone_in_team');
  });

  it('refuses a branch of another clinic and an empty role list', async () => {
    const other = await world.clinic();
    const foreign = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'doctor', branchId: other.branchId }],
    });
    expect(foreign.res.statusCode).toBe(400);
    const none = await addMember(world.app, clinic.owner.cookie, {
      phone: world.phone(),
      roles: [],
    });
    expect(none.res.statusCode).toBe(400);
  });
});

describe('team list and member detail', () => {
  it('lists every member with status in words and roles with scope', async () => {
    const res = await get(world.app, '/team/members', clinic.owner.cookie);
    expect(res.statusCode).toBe(200);
    const members = res.json<{ members: { id: string; status: string; roles: unknown[] }[] }>()
      .members;
    const owner = members.find((m) => m.id === clinic.ownerMembershipId);
    expect(owner).toMatchObject({
      status: 'active',
      roles: [{ role: 'owner', branchId: null, branchName: null }],
    });
    expect(members.some((m) => m.status === 'pending')).toBe(true);
  });

  it('gives toggles with the role default and marks the last owner', async () => {
    const res = await get(
      world.app,
      `/team/members/${clinic.ownerMembershipId}`,
      clinic.owner.cookie,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      isLastOwner: true,
      permissions: [
        { key: 'clinical.notes.view', roleDefault: false, granted: false, overridden: false },
      ],
    });
  });

  it('answers 404 for a member of another clinic', async () => {
    const other = await world.clinic();
    const res = await get(
      world.app,
      `/team/members/${other.ownerMembershipId}`,
      clinic.owner.cookie,
    );
    expect(res.statusCode).toBe(404);
  });
});

describe('editing roles and toggles', () => {
  it('changes roles and switches a sensitive key off and back to the default', async () => {
    const member = await activeMember(world, clinic, [{ role: 'assistant', branchId: null }]);
    const url = `/team/members/${member.membershipId}`;
    const detail = await get(world.app, url, clinic.owner.cookie);
    expect(detail.json()).toMatchObject({
      permissions: [{ key: 'clinical.notes.view', roleDefault: true, granted: true }],
    });

    const off = await patch(
      world.app,
      url,
      { permissions: [{ key: 'clinical.notes.view', granted: false }] },
      clinic.owner.cookie,
    );
    expect(off.statusCode).toBe(200);
    expect(off.json()).toMatchObject({
      permissions: [
        { key: 'clinical.notes.view', roleDefault: true, granted: false, overridden: true },
      ],
    });

    const reset = await patch(
      world.app,
      url,
      {
        roles: [{ role: 'receptionist', branchId: clinic.branchId }],
        permissions: [{ key: 'clinical.notes.view', granted: null }],
      },
      clinic.owner.cookie,
    );
    expect(reset.json()).toMatchObject({
      roles: [{ role: 'receptionist', branchId: clinic.branchId }],
      permissions: [
        { key: 'clinical.notes.view', roleDefault: false, granted: false, overridden: false },
      ],
    });
  });

  it('refuses an override for a non-sensitive key and for an unknown key', async () => {
    const member = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const url = `/team/members/${member.membershipId}`;
    const plain = await patch(
      world.app,
      url,
      { permissions: [{ key: 'members.manage', granted: true }] },
      clinic.owner.cookie,
    );
    expect(plain.statusCode).toBe(400);
    expect(errorCode(plain)).toBe('permission_not_sensitive');
    const unknown = await patch(
      world.app,
      url,
      { permissions: [{ key: 'made.up', granted: true }] },
      clinic.owner.cookie,
    );
    expect(unknown.statusCode).toBe(400);
    // The member could not gain members.manage through the refused override.
    expect((await get(world.app, '/team/members', member.cookie)).statusCode).toBe(403);
  });

  it('applies new grants on the member’s next request', async () => {
    const member = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    expect((await get(world.app, '/team/members', member.cookie)).statusCode).toBe(403);
    await patch(
      world.app,
      `/team/members/${member.membershipId}`,
      {
        roles: [
          { role: 'doctor', branchId: null },
          { role: 'owner', branchId: null },
        ],
      },
      clinic.owner.cookie,
    );
    // An owner now: TOTP first (A-01a criterion 11), then the team.
    const res = await get(world.app, '/team/members', member.cookie);
    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('mfa_enrolment_required');
  });
});
