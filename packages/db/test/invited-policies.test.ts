// A-01-05 checkpoint 3 (OD-90): the clinic chooser lists the signed-in person's pending
// invitations and accepts or declines them by id, without the link. On the auth path
// (withUser), shifa_auth sees a membership that is pending, unbound, for the account's phone and
// has an open invitation link carrying that phone (`setup_link.invited_phone`); nothing else.
// It binds such a membership to the signed-in person only (never a super admin) while the link
// is open, and marks that link used. A declined, expired, replaced or other phone's invitation,
// and any member link, stay out of reach. The link names the membership's own phone (foreign key).
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

describe('accepting and declining by id', () => {
  const bind = (userId: string, membershipId: string, to = userId) =>
    asUser(userId, (tx) =>
      tx.execute<{ id: string }>(sql`update membership set user_id = ${to}, status = 'active',
          updated_at = now() where id = ${membershipId} returning id`),
    );
  const useLink = (userId: string, linkId: string) =>
    asUser(userId, (tx) =>
      tx.execute<{ id: string }>(
        sql`update setup_link set used_at = now() where id = ${linkId} returning id`,
      ),
    );

  it('binds the open invitation to the signed-in person and marks its link used', async () => {
    expect((await bind(PERSON, memberOf('open'))).rows).toHaveLength(1);
    expect((await useLink(PERSON, linkOf('open'))).rows).toHaveLength(1);
    const { rows } = await su().execute<{ user_id: string; status: string; used: boolean }>(
      sql`select m.user_id, m.status, sl.used_at is not null as used
            from membership m join setup_link sl on sl.membership_id = m.id
           where m.id = ${memberOf('open')}`,
    );
    expect(rows).toEqual([{ user_id: PERSON, status: 'active', used: true }]);
  });

  it.each(['declined', 'expired', 'replaced', 'other phone', 'member link'] as const)(
    'binds nothing for a %s invitation',
    async (kind) => {
      expect((await bind(PERSON, memberOf(kind))).rows).toEqual([]);
    },
  );

  it('refuses binding the invitation to someone else', async () => {
    expect(await sqlState(() => bind(PERSON, memberOf('open'), OTHER))).toBe('42501');
  });

  it('refuses a super admin’s account (OD-89)', async () => {
    expect(await sqlState(() => bind(ADMIN, memberOf('admin')))).toBe('42501');
  });

  it('marks only open invitation links of the account’s phone used', async () => {
    for (const kind of ['declined', 'expired', 'replaced', 'other phone', 'member link'] as const) {
      expect((await useLink(PERSON, linkOf(kind))).rows, kind).toEqual([]);
    }
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
