// A-01b criteria 4, 9, 12 (A-01-05): the owner creates, edits and archives branches. The last
// active branch cannot be archived (409 `last_branch`); an archived branch is listed apart,
// cannot be edited, and the role picker refuses it (409 `branch_archived`). Archiving ends the
// sessions of exactly the members left without an active branch in their roles; the preview
// names them first. One audit row per branch event, never a phone. Another clinic's branch is
// not found.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { testClock } from '../identity/support.ts';
import {
  activeMember,
  addMember,
  type Clinic,
  errorCode,
  get,
  patch,
  post,
  sessionsOf,
  type TeamWorld,
  teamWorld,
  tenantAuditRows,
} from '../team/support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;
let other: Clinic;

interface BranchBody {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  archivedAt: string | null;
  memberCount: number;
}

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_05);
  clinic = await world.clinic();
  other = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

async function createBranch(
  c: Clinic,
  body: Record<string, unknown> = { name: 'فرع الجميلية' },
): Promise<BranchBody> {
  const res = await post(world.app, '/branches', body, c.owner.cookie);
  expect(res.statusCode, res.body).toBe(201);
  return res.json<BranchBody>();
}

describe('list, create and edit', () => {
  it('lists the main branch as the only active one', async () => {
    const res = await get(world.app, '/branches', clinic.owner.cookie);
    expect(res.statusCode).toBe(200);
    const body = res.json<{ active: BranchBody[]; archived: BranchBody[] }>();
    expect(body.active.map((b) => b.id)).toEqual([clinic.branchId]);
    expect(body.archived).toEqual([]);
  });

  it('creates a branch with address and phone (normalised to E.164)', async () => {
    const phone = world.phone();
    const local = `0${phone.slice(4)}`;
    const created = await createBranch(clinic, {
      name: '  فرع العزيزية ',
      address: 'شارع القوتلي',
      phone: local,
    });
    expect(created).toMatchObject({
      name: 'فرع العزيزية',
      address: 'شارع القوتلي',
      phone,
      archivedAt: null,
      memberCount: 0,
    });
    const list = (await get(world.app, '/branches', clinic.owner.cookie)).json<{
      active: BranchBody[];
    }>();
    expect(list.active.map((b) => b.id)).toContain(created.id);
  });

  it('refuses an invalid phone (400 on body.phone)', async () => {
    const res = await post(
      world.app,
      '/branches',
      { name: 'فرع', phone: '12' },
      clinic.owner.cookie,
    );
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { details: [{ path: 'body.phone' }] } });
  });

  it('edits name, address and phone; null clears address and phone', async () => {
    const b = await createBranch(clinic, {
      name: 'فرع قديم',
      address: 'عنوان',
      phone: world.phone(),
    });
    const res = await patch(
      world.app,
      `/branches/${b.id}`,
      { name: 'فرع جديد', address: null, phone: null },
      clinic.owner.cookie,
    );
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({ id: b.id, name: 'فرع جديد', address: null, phone: null });
  });

  it('another clinic’s branch is not found', async () => {
    const theirs = await createBranch(other, { name: 'فرع عيادة أخرى' });
    const edit = await patch(
      world.app,
      `/branches/${theirs.id}`,
      { name: 'x' },
      clinic.owner.cookie,
    );
    expect(edit.statusCode).toBe(404);
    const archive = await post(
      world.app,
      `/branches/${theirs.id}/archive`,
      {},
      clinic.owner.cookie,
    );
    expect(archive.statusCode).toBe(404);
    const preview = await get(
      world.app,
      `/branches/${theirs.id}/archive-preview`,
      clinic.owner.cookie,
    );
    expect(preview.statusCode).toBe(404);
    const list = (await get(world.app, '/branches', clinic.owner.cookie)).json<{
      active: BranchBody[];
    }>();
    expect(list.active.map((b) => b.id)).not.toContain(theirs.id);
  });
});

describe('archive', () => {
  it('refuses the last active branch (409 last_branch), and says so in the preview', async () => {
    const solo = await world.clinic();
    const preview = await get(
      world.app,
      `/branches/${solo.branchId}/archive-preview`,
      solo.owner.cookie,
    );
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ lastBranch: true, members: [] });
    const res = await post(world.app, `/branches/${solo.branchId}/archive`, {}, solo.owner.cookie);
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('last_branch');
  });

  it('ends the sessions of members left without an active branch, and only theirs', async () => {
    const c = await world.clinic();
    const second = await createBranch(c, { name: 'فرع الحمدانية' });
    const onlyThere = await activeMember(world, c, [{ role: 'doctor', branchId: second.id }]);
    const tenantWide = await activeMember(world, c, [{ role: 'receptionist', branchId: null }]);
    const both = await activeMember(world, c, [
      { role: 'assistant', branchId: second.id },
      { role: 'assistant', branchId: c.branchId },
    ]);
    const pending = await addMember(world.app, c.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'accountant', branchId: second.id }],
    });
    expect(pending.res.statusCode).toBe(201);

    const listed = (await get(world.app, '/branches', c.owner.cookie)).json<{
      active: BranchBody[];
    }>();
    expect(listed.active.find((b) => b.id === second.id)?.memberCount).toBe(2);

    const preview = await get(world.app, `/branches/${second.id}/archive-preview`, c.owner.cookie);
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toEqual({
      lastBranch: false,
      members: [{ id: onlyThere.membershipId, name: 'موظف تجريبي' }],
    });

    const res = await post(world.app, `/branches/${second.id}/archive`, {}, c.owner.cookie);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json<BranchBody>().archivedAt).not.toBeNull();

    expect((await get(world.app, '/auth/session', onlyThere.cookie)).statusCode).toBe(401);
    expect(await sessionsOf(onlyThere.userId)).toEqual([]);
    for (const kept of [tenantWide, both]) {
      expect((await get(world.app, '/auth/session', kept.cookie)).statusCode).toBe(200);
    }
    expect((await get(world.app, '/auth/session', c.owner.cookie)).statusCode).toBe(200);

    const after = (await get(world.app, '/branches', c.owner.cookie)).json<{
      active: BranchBody[];
      archived: BranchBody[];
    }>();
    expect(after.active.map((b) => b.id)).toEqual([c.branchId]);
    expect(after.archived.map((b) => b.id)).toEqual([second.id]);
  });

  it('an archived branch cannot be edited, archived again or given in a role (409 branch_archived)', async () => {
    const c = await world.clinic();
    const second = await createBranch(c, { name: 'فرع مؤرشف' });
    expect(
      (await post(world.app, `/branches/${second.id}/archive`, {}, c.owner.cookie)).statusCode,
    ).toBe(200);
    const edit = await patch(world.app, `/branches/${second.id}`, { name: 'x' }, c.owner.cookie);
    expect([edit.statusCode, errorCode(edit)]).toEqual([409, 'branch_archived']);
    const again = await post(world.app, `/branches/${second.id}/archive`, {}, c.owner.cookie);
    expect([again.statusCode, errorCode(again)]).toEqual([409, 'branch_archived']);

    const added = await addMember(world.app, c.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'doctor', branchId: second.id }],
    });
    expect([added.res.statusCode, errorCode(added.res)]).toEqual([409, 'branch_archived']);

    const m = await activeMember(world, c, [{ role: 'doctor', branchId: null }]);
    const changed = await patch(
      world.app,
      `/team/members/${m.membershipId}`,
      { roles: [{ role: 'doctor', branchId: second.id }] },
      c.owner.cookie,
    );
    expect([changed.statusCode, errorCode(changed)]).toEqual([409, 'branch_archived']);
  });
});

describe('audit (criterion 12)', () => {
  it('one row per created, renamed and archived branch; no phone', async () => {
    const c = await world.clinic();
    const phone = world.phone();
    const b = await createBranch(c, { name: 'فرع للتدقيق', phone });
    await patch(world.app, `/branches/${b.id}`, { name: 'فرع مدقق' }, c.owner.cookie);
    await post(world.app, `/branches/${b.id}/archive`, {}, c.owner.cookie);
    const ownerId = (await get(world.app, '/auth/session', c.owner.cookie)).json<{
      userId: string;
    }>().userId;
    const rows = (await tenantAuditRows(c.clinicId)).filter((r) => r.event.startsWith('branch.'));
    expect(rows.map((r) => [r.event, r.targetId, r.actorId])).toEqual([
      ['branch.created', b.id, ownerId],
      ['branch.renamed', b.id, ownerId],
      ['branch.archived', b.id, ownerId],
    ]);
    const text = JSON.stringify(rows);
    expect(text).not.toContain(phone);
    expect(text).not.toContain(phone.slice(4));
  });
});
