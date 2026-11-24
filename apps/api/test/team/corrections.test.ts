// A-01b criterion 3, OD-103 (A-01-12): the owner corrects any member's name, and a pending
// member's phone: the earlier link stops, a new one is shown once (an invitation when the new
// phone has an account), refused once the member has accepted or is deactivated; phone_in_team
// holds. Audited without the name or a phone. Actions on oneself that would lock the owner out are
// refused (`self_action`, no audit row); the bare 409s are named.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PASSWORD, seedPerson, sessionCookie, signIn, testClock } from '../identity/support.ts';
import {
  activeMember,
  addMember,
  type Clinic,
  errorCode,
  get,
  membershipRow,
  patch,
  post,
  type TeamWorld,
  teamWorld,
  tenantAuditRows,
  tokenOf,
  useMemberLink,
} from './support.ts';

const clock = testClock();
let world: TeamWorld;
let clinic: Clinic;

beforeAll(async () => {
  world = await teamWorld(clock, 2026_12_11);
  clinic = await world.clinic();
});

afterAll(async () => {
  await world.app.app.close();
});

const url = (id: string, action = '') => `/team/members/${id}${action}`;
const changePhone = (id: string, phone: string, cookie: string = clinic.owner.cookie) =>
  patch(world.app, url(id, '/phone'), { phone }, cookie);

async function pending(roles = [{ role: 'assistant' as const, branchId: null }]) {
  const added = await addMember(world.app, clinic.owner.cookie, { phone: world.phone(), roles });
  expect(added.res.statusCode, added.res.body).toBe(201);
  return added;
}

const rowsOf = async (membershipId: string, event: string) =>
  (await tenantAuditRows(clinic.clinicId)).filter(
    (r) => r.targetId === membershipId && r.event === event,
  );

describe('renaming a member (OD-103)', () => {
  it('renames an active, a pending and a deactivated member; audited without the name', async () => {
    const active = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const waiting = await pending();
    const off = await pending();
    await post(world.app, url(off.membershipId, '/deactivate'), {}, clinic.owner.cookie);
    for (const id of [active.membershipId, waiting.membershipId, off.membershipId]) {
      const res = await patch(world.app, url(id), { name: '  اسم مصحّح ' }, clinic.owner.cookie);
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({ id, name: 'اسم مصحّح' });
      const rows = await rowsOf(id, 'member.renamed');
      expect(rows).toHaveLength(1);
      expect(JSON.stringify(rows)).not.toContain('اسم مصحّح');
    }
  });

  it('refuses an empty name (400 on body.name)', async () => {
    const waiting = await pending();
    const res = await patch(
      world.app,
      url(waiting.membershipId),
      { name: '  ' },
      clinic.owner.cookie,
    );
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { details: [{ path: 'body.name' }] } });
  });
});

describe('a pending member’s phone (OD-103)', () => {
  it('replaces the link: the new one works, the earlier one is invalid; audited without a phone', async () => {
    const waiting = await pending();
    const phone = world.phone();
    const res = await changePhone(waiting.membershipId, `0${phone.slice(4)}`);
    expect(res.statusCode, res.body).toBe(200);
    const link = res.json<{ url: string; whatsappUrl: string; expiresAt: string }>();
    expect(link).not.toHaveProperty('purpose');

    const old = await post(world.app, '/auth/setup-link/consume', {
      token: tokenOf(waiting.linkUrl),
      password: PASSWORD,
    });
    expect(errorCode(old)).toBe('link_invalid');

    const detail = await get(world.app, url(waiting.membershipId), clinic.owner.cookie);
    expect(detail.json()).toMatchObject({ phone, linkExpiresAt: link.expiresAt });

    const rows = await rowsOf(waiting.membershipId, 'member.phone_changed');
    expect(rows.map((r) => r.data)).toEqual([{ linkPurpose: 'member_setup' }]);
    const text = JSON.stringify(await tenantAuditRows(clinic.clinicId));
    expect(text).not.toContain(phone);
    expect(text).not.toContain(phone.slice(4));

    await useMemberLink(world.app, link.url);
    const [row] = await membershipRow(waiting.membershipId);
    expect(row).toMatchObject({ status: 'active', phoneE164: phone });
  });

  it('to a phone with an account: an invitation that person accepts', async () => {
    const waiting = await pending();
    const person = await seedPerson(world.phone());
    const res = await changePhone(waiting.membershipId, person.phone);
    expect(res.statusCode, res.body).toBe(200);
    const token = tokenOf(res.json<{ url: string }>().url);
    const cookie = sessionCookie(await signIn(world.app, person.phone, PASSWORD));
    const accepted = await post(world.app, '/invitations/accept', { token }, cookie);
    expect(accepted.statusCode, accepted.body).toBe(204);
    const rows = await rowsOf(waiting.membershipId, 'member.phone_changed');
    expect(rows.map((r) => r.data)).toEqual([{ linkPurpose: 'invitation' }]);
  });

  it('the same phone again: a new link, the earlier one stops', async () => {
    const waiting = await pending();
    const [row] = await membershipRow(waiting.membershipId);
    const res = await changePhone(waiting.membershipId, row?.phoneE164 ?? '');
    expect(res.statusCode).toBe(200);
    const old = await post(world.app, '/auth/setup-link/consume', {
      token: tokenOf(waiting.linkUrl),
      password: PASSWORD,
    });
    expect(errorCode(old)).toBe('link_invalid');
    await useMemberLink(world.app, res.json<{ url: string }>().url);
  });

  it('an accepted member → 409 member_account_exists; the phone stays', async () => {
    const active = await activeMember(world, clinic, [{ role: 'doctor', branchId: null }]);
    const res = await changePhone(active.membershipId, world.phone());
    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('member_account_exists');
    const [row] = await membershipRow(active.membershipId);
    expect(row?.phoneE164).toBe(active.phone);
  });

  it('a deactivated member → 409 member_deactivated', async () => {
    const off = await pending();
    await post(world.app, url(off.membershipId, '/deactivate'), {}, clinic.owner.cookie);
    const res = await changePhone(off.membershipId, world.phone());
    expect([res.statusCode, errorCode(res)]).toEqual([409, 'member_deactivated']);
  });

  it('a phone already in the team → 409 phone_in_team', async () => {
    const waiting = await pending();
    const res = await changePhone(waiting.membershipId, clinic.ownerPhone);
    expect([res.statusCode, errorCode(res)]).toEqual([409, 'phone_in_team']);
  });

  it('an invalid phone → 400 on body.phone; an unknown id → 404; a receptionist → 403', async () => {
    const waiting = await pending();
    const invalid = await changePhone(waiting.membershipId, '12');
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: { details: [{ path: 'body.phone' }] } });
    const unknown = await changePhone('0193c5a4-7b2e-7c1a-9f00-00000000dead', world.phone());
    expect(unknown.statusCode).toBe(404);
    const desk = await activeMember(world, clinic, [{ role: 'receptionist', branchId: null }]);
    expect((await changePhone(waiting.membershipId, world.phone(), desk.cookie)).statusCode).toBe(
      403,
    );
  });

  it('another clinic’s member is not found (404); rename too', async () => {
    const other = await world.clinic();
    const theirs = await addMember(world.app, other.owner.cookie, {
      phone: world.phone(),
      roles: [{ role: 'doctor', branchId: null }],
    });
    expect((await changePhone(theirs.membershipId, world.phone())).statusCode).toBe(404);
    const rename = await patch(
      world.app,
      url(theirs.membershipId),
      { name: 'x' },
      clinic.owner.cookie,
    );
    expect(rename.statusCode).toBe(404);
  });
});

describe('actions on oneself (gap 7) and named 409s (gap 2)', () => {
  it('deactivate, new link and TOTP reset on oneself → 409 self_action; no audit row', async () => {
    const before = (await tenantAuditRows(clinic.clinicId)).length;
    for (const action of ['/deactivate', '/setup-link', '/reset-mfa']) {
      const res = await post(
        world.app,
        url(clinic.ownerMembershipId, action),
        {},
        clinic.owner.cookie,
      );
      expect([res.statusCode, errorCode(res)], action).toEqual([409, 'self_action']);
    }
    expect((await tenantAuditRows(clinic.clinicId)).length).toBe(before);
    expect((await get(world.app, '/auth/session', clinic.owner.cookie)).statusCode).toBe(200);
  });

  it('deactivating twice → 409 member_deactivated', async () => {
    const waiting = await pending();
    const first = await post(
      world.app,
      url(waiting.membershipId, '/deactivate'),
      {},
      clinic.owner.cookie,
    );
    expect(first.statusCode).toBe(200);
    const twice = await post(
      world.app,
      url(waiting.membershipId, '/deactivate'),
      {},
      clinic.owner.cookie,
    );
    expect([twice.statusCode, errorCode(twice)]).toEqual([409, 'member_deactivated']);
  });
});
