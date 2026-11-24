// A-01b criteria 2 and 7, OD-102 (A-01-12): the sensitive keys with the roles that grant each by
// default; toggles set when adding a member, stored only where they differ from the default of the
// given roles, the add refused whole on a refused switch. The team list shows the open link's
// expiry (null once accepted) and marks the caller's own row.
import { setupLink } from '@shifa/db';
import { superuserDb, workerDatabaseName } from '@shifa/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
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
  useMemberLink,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_10);
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

interface Permission {
  key: string;
  roleDefault: boolean;
  granted: boolean;
  overridden: boolean;
}
interface Summary {
  id: string;
  phone: string;
  linkExpiresAt: string | null;
  isSelf: boolean;
}

const notesOf = (body: { permissions: Permission[] }) =>
  body.permissions.find((p) => p.key === 'clinical.notes.view');

function addWith(phone: string, permissions: unknown, role = 'doctor') {
  return post(
    world.app,
    '/team/members',
    { name: 'د. ليلى', phone, roles: [{ role, branchId: null }], permissions },
    clinic.owner.cookie,
  );
}

async function members(): Promise<Summary[]> {
  const res = await get(world.app, '/team/members', clinic.owner.cookie);
  expect(res.statusCode).toBe(200);
  return res.json<{ members: Summary[] }>().members;
}

describe('the sensitive keys with each role’s default (OD-102)', () => {
  it('lists clinical.notes.view with doctor and assistant', async () => {
    const res = await get(world.app, '/team/permissions', clinic.owner.cookie);
    expect(res.statusCode, res.body).toBe(200);
    const keys = res.json<{ keys: { key: string; roles: string[] }[] }>().keys;
    const notes = keys.find((k) => k.key === 'clinical.notes.view');
    expect([...(notes?.roles ?? [])].sort()).toEqual(['assistant', 'doctor']);
    // Only sensitive keys.
    expect(keys.map((k) => k.key)).not.toContain('members.manage');
  });

  it('a receptionist is refused (403)', async () => {
    const desk = await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]);
    expect((await get(world.app, '/team/permissions', desk.cookie)).statusCode).toBe(403);
  });
});

describe('toggles on add', () => {
  it('a switch off for a doctor is stored and audited', async () => {
    const res = await addWith(world.phone(), [{ key: 'clinical.notes.view', granted: false }]);
    expect(res.statusCode, res.body).toBe(201);
    const member = res.json<{ member: { id: string; permissions: Permission[] } }>().member;
    expect(notesOf(member)).toEqual({
      key: 'clinical.notes.view',
      roleDefault: true,
      granted: false,
      overridden: true,
    });
    const rows = (await tenantAuditRows(clinic.clinicId)).filter(
      (r) => r.targetId === member.id && r.event === 'member.permissions_changed',
    );
    expect(rows.map((r) => r.data)).toEqual([{ key: 'clinical.notes.view', granted: false }]);
  });

  it('a switch equal to the role default stores nothing', async () => {
    const res = await addWith(world.phone(), [{ key: 'clinical.notes.view', granted: true }]);
    expect(res.statusCode).toBe(201);
    const member = res.json<{ member: { id: string; permissions: Permission[] } }>().member;
    expect(notesOf(member)).toMatchObject({ granted: true, overridden: false });
    const rows = (await tenantAuditRows(clinic.clinicId)).filter(
      (r) => r.targetId === member.id && r.event === 'member.permissions_changed',
    );
    expect(rows).toEqual([]);
  });

  it('a switch on for a receptionist is stored', async () => {
    const res = await addWith(
      world.phone(),
      [{ key: 'clinical.notes.view', granted: true }],
      'receptionist',
    );
    expect(res.statusCode).toBe(201);
    expect(notesOf(res.json<{ member: { permissions: Permission[] } }>().member)).toMatchObject({
      roleDefault: false,
      granted: true,
      overridden: true,
    });
  });

  it('a non-sensitive key → 400 permission_not_sensitive; nothing is added', async () => {
    const phone = world.phone();
    const res = await addWith(phone, [{ key: 'members.manage', granted: true }]);
    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('permission_not_sensitive');
    expect((await members()).map((m) => m.phone)).not.toContain(phone);
  });

  it('an unknown key → 400 on body.permissions.0.key; nothing is added', async () => {
    const phone = world.phone();
    const res = await addWith(phone, [{ key: 'unknown.key', granted: true }]);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'validation_failed', details: [{ path: 'body.permissions.0.key' }] },
    });
    expect((await members()).map((m) => m.phone)).not.toContain(phone);
  });
});

describe('the open link’s expiry and the caller’s own row', () => {
  it('linkExpiresAt: the new link, a past date once expired, null after acceptance', async () => {
    const phone = world.phone();
    const added = await addMember(world.app, clinic.owner.cookie, {
      phone,
      roles: [{ role: 'assistant', branchId: null }],
    });
    const issued = added.res.json<{ link: { expiresAt: string } }>().link.expiresAt;
    expect(added.res.json<{ member: Summary }>().member.linkExpiresAt).toBe(issued);
    expect((await members()).find((m) => m.id === added.membershipId)?.linkExpiresAt).toBe(issued);

    // Expired (the date moved into the past): still shown, so the owner reads «انتهى الرابط».
    const past = new Date(Date.now() - 3_600_000);
    await superuserDb(workerDatabaseName())
      .update(setupLink)
      .set({ expiresAt: past })
      .where(eq(setupLink.membershipId, added.membershipId));
    expect((await members()).find((m) => m.id === added.membershipId)?.linkExpiresAt).toBe(
      past.toISOString(),
    );

    // A new link: its date.
    const again = await post(
      world.app,
      `/team/members/${added.membershipId}/setup-link`,
      {},
      clinic.owner.cookie,
    );
    expect(again.statusCode).toBe(200);
    const next = again.json<{ url: string; expiresAt: string }>();
    const detail = await get(world.app, `/team/members/${added.membershipId}`, clinic.owner.cookie);
    expect(detail.json<Summary>().linkExpiresAt).toBe(next.expiresAt);

    // Accepted: no open link.
    await useMemberLink(world.app, next.url);
    expect((await members()).find((m) => m.id === added.membershipId)?.linkExpiresAt).toBeNull();
  });

  it('isSelf only on the caller’s row, in the list and the detail', async () => {
    const list = await members();
    expect(list.filter((m) => m.isSelf).map((m) => m.id)).toEqual([clinic.ownerMembershipId]);
    const own = await get(
      world.app,
      `/team/members/${clinic.ownerMembershipId}`,
      clinic.owner.cookie,
    );
    expect(own.json<Summary>().isSelf).toBe(true);
    const someone = list.find((m) => !m.isSelf);
    const theirs = await get(world.app, `/team/members/${someone?.id ?? ''}`, clinic.owner.cookie);
    expect(theirs.json<Summary>().isSelf).toBe(false);
  });
});
