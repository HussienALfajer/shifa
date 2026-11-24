// A-01-05 checkpoint 3 (OD-90, OD-91): the clinic chooser lists the signed-in person's pending
// invitations. On the auth path (withUser), shifa_auth sees a membership that is pending,
// unbound, for the account's phone and has an open invitation link carrying that phone
// (`setup_link.invited_phone`); nothing else. It can neither bind such a membership nor mark its
// link used by phone: phones are unverified until A-09, so accepting and declining stay on the
// invitation's link (OD-91). The link names the membership's own phone (foreign key).
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Tx } from '../src/index.ts';
import {
  createTestTenants,
  fixtureId,
  insertMembership,
  insertUser,
  superuserDb,
  syntheticPhones,
  testAuthDb,
  testDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const [PHONE = '', OTHER_PHONE = '', ADMIN_PHONE = ''] = syntheticPhones(7951, 3);
const PERSON = fixtureId('invited person');
const OTHER = fixtureId('invited other person');
const ADMIN = fixtureId('invited super admin');
const SEEDER = fixtureId('invited seeder');

type Kind = 'open' | 'declined' | 'expired' | 'replaced' | 'other phone' | 'member link' | 'admin';
const KINDS: readonly Kind[] = [
  'open',
  'declined',
  'expired',
  'replaced',
  'other phone',
  'member link',
  'admin',
];
const tenantOf = (kind: Kind) => fixtureId(`invited tenant ${kind}`);
const memberOf = (kind: Kind) => fixtureId(`invited membership ${kind}`);
const linkOf = (kind: Kind) => fixtureId(`invited link ${kind}`);
const phoneOf = (kind: Kind) =>
  kind === 'other phone' ? OTHER_PHONE : kind === 'admin' ? ADMIN_PHONE : PHONE;

const su = () => superuserDb(workerDatabaseName());

async function sqlState(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
    return undefined;
  } catch (err) {
    const cause = (err as { cause?: { code?: string }; code?: string }).cause;
    return cause?.code ?? (err as { code?: string }).code;
  }
}

const asUser = <T>(userId: string, fn: (tx: Tx) => Promise<T>) => testAuthDb().withUser(userId, fn);

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

beforeEach(async () => {
  await createTestTenants(...KINDS.map(tenantOf));
  await testAuthDb().withAuth(async (tx) => {
    await insertUser(tx, { id: PERSON, phone: PHONE });
    await insertUser(tx, { id: OTHER, phone: OTHER_PHONE });
    await insertUser(tx, { id: ADMIN, phone: ADMIN_PHONE });
  });
  await su().execute(sql`insert into platform_admin (user_id) values (${ADMIN})`);
  for (const kind of KINDS) {
    const tenantId = tenantOf(kind);
    const membershipId = memberOf(kind);
    const phone = phoneOf(kind);
    await testDb().withTenant({ tenantId, userId: SEEDER }, async (tx) => {
      await insertMembership(tx, { id: membershipId, tenantId, phone });
      await tx.execute(sql`insert into role_assignment (tenant_id, membership_id, role)
        values (${tenantId}, ${membershipId}, 'doctor')`);
      const purpose = kind === 'member link' ? 'member_setup' : 'invitation';
      const invitedPhone = kind === 'member link' ? null : phone;
      const expires =
        kind === 'expired' ? sql`now() - interval '1 minute'` : sql`now() + interval '72 hours'`;
      await tx.execute(sql`insert into setup_link
          (id, tenant_id, membership_id, purpose, token_hash, expires_at, invited_phone)
        values (${linkOf(kind)}, ${tenantId}, ${membershipId}, ${purpose},
                ${'ab'.repeat(32)}, ${expires}, ${invitedPhone})`);
      if (kind === 'replaced') {
        await tx.execute(sql`update setup_link set replaced_at = now() where id = ${linkOf(kind)}`);
      }
    });
    if (kind === 'declined') {
      await su().execute(sql`update setup_link set used_at = now() where id = ${linkOf(kind)}`);
    }
  }
});

describe('reading invitations on the auth path (withUser)', () => {
  it('sees only the open invitation for the account’s phone, and its open link', async () => {
    const seen = await asUser(PERSON, async (tx) => ({
      members: (await tx.execute<{ id: string }>(sql`select id from membership`)).rows,
      links: (await tx.execute<{ id: string }>(sql`select id from setup_link`)).rows,
      tenants: (await tx.execute<{ id: string }>(sql`select id from tenant`)).rows,
    }));
    expect(ids(seen.members)).toEqual([memberOf('open')]);
    // The link of a declined, expired or replaced invitation for this phone is visible but not
    // usable; the membership behind it is not.
    expect(ids(seen.links)).toEqual(
      [linkOf('open'), linkOf('declined'), linkOf('expired'), linkOf('replaced')].sort(),
    );
    expect(seen.tenants).toEqual([]);
  });

  it('sees nothing without a signed-in person (withAuth)', async () => {
    const rows = await testAuthDb().withAuth(async (tx) => ({
      members: (await tx.execute(sql`select id from membership`)).rows,
      links: (await tx.execute(sql`select id from setup_link`)).rows,
    }));
    expect(rows).toEqual({ members: [], links: [] });
  });

  it('another person sees only their own phone’s invitation', async () => {
    const rows = await asUser(OTHER, (tx) =>
      tx.execute<{ id: string }>(sql`select id from membership`),
    );
    expect(ids(rows.rows)).toEqual([memberOf('other phone')]);
  });
});

describe('no answer by phone (OD-91): accepting and declining stay on the link', () => {
  const bind = (userId: string, membershipId: string) =>
    asUser(userId, (tx) =>
      tx.execute<{ id: string }>(sql`update membership set user_id = ${userId}, status = 'active',
          updated_at = now() where id = ${membershipId} returning id`),
    );
  const useLink = (userId: string, linkId: string) =>
    asUser(userId, (tx) =>
      tx.execute<{ id: string }>(
        sql`update setup_link set used_at = now() where id = ${linkId} returning id`,
      ),
    );

  it.each(KINDS)('binds no %s invitation without its link', async (kind) => {
    const userId = kind === 'admin' ? ADMIN : PERSON;
    expect((await bind(userId, memberOf(kind))).rows).toEqual([]);
    const { rows } = await su().execute<{ user_id: string | null }>(
      sql`select user_id from membership where id = ${memberOf(kind)}`,
    );
    expect(rows).toEqual([{ user_id: null }]);
  });

  it.each(KINDS)('marks no %s invitation link used without its token', async (kind) => {
    expect((await useLink(PERSON, linkOf(kind))).rows).toEqual([]);
  });

  it('cannot change anything else on the link', async () => {
    expect(
      await sqlState(() =>
        asUser(PERSON, (tx) =>
          tx.execute(sql`update setup_link set replaced_at = now() where id = ${linkOf('open')}`),
        ),
      ),
    ).toBe('42501');
  });
});

describe('the invited phone of a link (shifa_app)', () => {
  const insertLink = (purpose: string, invitedPhone: string) =>
    testDb().withTenant({ tenantId: tenantOf('open'), userId: SEEDER }, (tx) =>
      tx.execute(sql`insert into setup_link
          (tenant_id, membership_id, purpose, token_hash, expires_at, invited_phone)
        values (${tenantOf('open')}, ${memberOf('open')}, ${purpose}, ${'cd'.repeat(32)},
                now() + interval '72 hours', ${invitedPhone})`),
    );

  it('must be the membership’s own phone', async () => {
    expect(await sqlState(() => insertLink('invitation', OTHER_PHONE))).toBe('23503');
  });

  it('only on an invitation', async () => {
    expect(await sqlState(() => insertLink('member_setup', PHONE))).toBe('23514');
  });
});
