// A-01-04 security review L2 and OD-89, at the database: a clinic (shifa_app) writes only fresh
// member links and invitations of about 72 h and afterwards only marks them replaced, never
// reopening a used link or extending one; any link binds only the account of the phone its
// membership names; a super admin's account is never bound to a clinic.
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
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

const TENANT = fixtureId('team-links tenant');
const SEEDER = fixtureId('team-links seeder');
const PERSON = fixtureId('team-links person');
const STRANGER = fixtureId('team-links stranger');
const MEMBER = fixtureId('team-links membership');
const LINK = fixtureId('team-links link');
const HASH = 'd4'.repeat(32);
const [PHONE = '', STRANGER_PHONE = ''] = syntheticPhones(7901, 2);

const inTenant = <T>(fn: Parameters<ReturnType<typeof testDb>['withTenant']>[1]) =>
  testDb().withTenant({ tenantId: TENANT, userId: SEEDER }, fn) as Promise<T>;

async function sqlState(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
    return undefined;
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause;
    return cause?.code ?? (err as { code?: string }).code;
  }
}

async function link(purpose: 'member_setup' | 'invitation'): Promise<void> {
  await inTenant(async (tx) => {
    await insertMembership(tx, { id: MEMBER, tenantId: TENANT, phone: PHONE });
    await tx.execute(sql`insert into setup_link (id, tenant_id, membership_id, purpose, token_hash, expires_at)
      values (${LINK}, ${TENANT}, ${MEMBER}, ${purpose}, ${HASH}, now() + interval '72 hours')`);
  });
}

beforeEach(async () => {
  await createTestTenants(TENANT);
  await testAuthDb().withAuth(async (tx) => {
    await insertUser(tx, { id: PERSON, phone: PHONE });
    await insertUser(tx, { id: STRANGER, phone: STRANGER_PHONE });
  });
});

describe('links a clinic writes', () => {
  it('cannot insert a long-lived, used, replaced or owner link', async () => {
    await inTenant((tx) => insertMembership(tx, { id: MEMBER, tenantId: TENANT, phone: PHONE }));
    const insert = (values: string) =>
      sqlState(() =>
        inTenant((tx) =>
          tx.execute(
            sql.raw(`insert into setup_link (tenant_id, membership_id, purpose, token_hash, expires_at, used_at, replaced_at)
              values ('${TENANT}', '${MEMBER}', ${values})`),
          ),
        ),
      );
    expect(await insert(`'member_setup', '${HASH}', now() + interval '10 days', null, null`)).toBe(
      '42501',
    );
    expect(await insert(`'member_setup', '${HASH}', now() + interval '1 hour', now(), null`)).toBe(
      '42501',
    );
    expect(await insert(`'invitation', '${HASH}', now() + interval '1 hour', null, now()`)).toBe(
      '42501',
    );
    expect(await insert(`'owner_setup', '${HASH}', now() + interval '1 hour', null, null`)).toBe(
      '42501',
    );
  });

  it('can only mark an open link replaced: no reopening, extending or re-pointing', async () => {
    await link('member_setup');
    for (const change of [
      sql`update setup_link set used_at = null`,
      sql`update setup_link set expires_at = now() + interval '10 days'`,
      sql`update setup_link set token_hash = ${'e6'.repeat(32)}`,
    ]) {
      expect(await sqlState(() => inTenant((tx) => tx.execute(change)))).toBe('42501');
    }
    const replaced = await inTenant<{ rowCount: number | null }>((tx) =>
      tx.execute(sql`update setup_link set replaced_at = now()`),
    );
    expect(replaced.rowCount).toBe(1);
    const again = await inTenant<{ rowCount: number | null }>((tx) =>
      tx.execute(sql`update setup_link set replaced_at = now()`),
    );
    expect(again.rowCount).toBe(0);
  });
});

describe('binding a membership on the auth path', () => {
  const useAndBind = async (userId: string, purpose: 'member_setup' | 'invitation') => {
    await link(purpose);
    const run = <T>(fn: Parameters<ReturnType<typeof testAuthDb>['withSetupLink']>[1]) =>
      (purpose === 'invitation'
        ? testAuthDb().withUserLink(userId, HASH, fn)
        : testAuthDb().withSetupLink(HASH, fn)) as Promise<T>;
    await run((tx) => tx.execute(sql`update setup_link set used_at = now()`));
    return sqlState(() =>
      run((tx) =>
        tx.execute(
          sql`update membership set user_id = ${userId}, status = 'active' where id = ${MEMBER}`,
        ),
      ),
    );
  };

  it('a member link binds only the account with the membership’s phone', async () => {
    expect(await useAndBind(STRANGER, 'member_setup')).toBe('42501');
  });

  it('never binds a super admin’s account (OD-89)', async () => {
    await superuserDb(workerDatabaseName()).execute(
      sql`insert into platform_admin (user_id) values (${PERSON})`,
    );
    expect(await useAndBind(PERSON, 'invitation')).toBe('42501');
  });

  it('binds the invited person with the invited phone', async () => {
    expect(await useAndBind(PERSON, 'invitation')).toBeUndefined();
  });
});
