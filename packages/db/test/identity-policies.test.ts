// Identity tables and the shifa_auth paths (A-01a criterion 1, A-01-01, ADR-0043). shifa_app
// sees only the signed-in person's identity rows (app.user_id) and never a secret column;
// shifa_auth reaches the identity tables, a person's own memberships across tenants and one
// setup link by its token hash, and nothing else.
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  account,
  authThrottle,
  session,
  type Tx,
  twoFactor,
  user,
  verification,
} from '../src/index.ts';
import {
  createTestTenants,
  fixtureId,
  insertMembership,
  insertSetupLink,
  insertUser,
  syntheticPhones,
  testAuthDb,
  testDb,
  withoutTenant,
} from '../test-harness/index.ts';

const T1 = fixtureId('identity tenant 1');
const T2 = fixtureId('identity tenant 2');
const T3 = fixtureId('identity tenant 3');
const U1 = fixtureId('identity user 1');
const U2 = fixtureId('identity user 2');
const [PHONE_1, PHONE_2, PHONE_3] = syntheticPhones(7101, 3);
const HASH_1 = 'a1'.repeat(32);
const LATER = new Date('2030-01-01T00:00:00Z');

const ids = (rows: readonly { id: string }[]) => rows.map((r) => r.id).sort();

beforeEach(async () => {
  await createTestTenants(T1, T2, T3);
  await testAuthDb().withAuth(async (tx) => {
    for (const [id, phone] of [
      [U1, PHONE_1],
      [U2, PHONE_2],
    ] as const) {
      await insertUser(tx, { id, phone });
      await tx.insert(session).values({
        id: fixtureId(`session ${id}`),
        userId: id,
        token: `token-${id}`,
        expiresAt: LATER,
      });
      await tx.insert(account).values({
        id: fixtureId(`account ${id}`),
        userId: id,
        accountId: id,
        providerId: 'credential',
        password: `hash-${id}`,
      });
      await tx.insert(twoFactor).values({
        id: fixtureId(`two factor ${id}`),
        userId: id,
        secret: `secret-${id}`,
        backupCodes: `codes-${id}`,
      });
    }
    await tx.insert(verification).values({
      id: fixtureId('verification'),
      identifier: 'identity-test',
      value: 'v',
      expiresAt: LATER,
    });
    await tx.insert(authThrottle).values({
      kind: 'phone',
      keyHash: 'd4'.repeat(32),
      windowStart: LATER,
      failures: 1,
    });
  });
  // U1 is a member of T1 and T2; U2 of T1; T3 has only a pending member with U1's phone.
  const members: [tenantId: string, userId: string | null, phone: string | undefined][] = [
    [T1, U1, PHONE_1],
    [T2, U1, PHONE_1],
    [T1, U2, PHONE_2],
    [T3, null, PHONE_3],
  ];
  for (const [tenantId, userId, phone] of members) {
    await testDb().withTenant({ tenantId, userId: U1 }, async (tx) => {
      const id = fixtureId(`member ${tenantId} ${userId ?? 'pending'}`);
      await insertMembership(tx, { id, tenantId, userId, phone: phone ?? '' });
      await insertSetupLink(tx, {
        id: fixtureId(`link ${id}`),
        tenantId,
        membershipId: id,
        tokenHashHex:
          tenantId === T1 && userId === U1 ? HASH_1 : createHash('sha256').update(id).digest('hex'),
      });
    });
  }
});

describe('shifa_app on identity tables (app.user_id)', () => {
  const asU1 = <T>(fn: (tx: Tx) => Promise<T>) =>
    testDb().withTenant({ tenantId: T1, userId: U1 }, fn);

  it('reads only the signed-in person in user, session, account and two_factor', async () => {
    await asU1(async (tx) => {
      expect(ids(await tx.select({ id: user.id }).from(user))).toEqual([U1]);
      const own = (rows: { userId: string }[]) => rows.map((r) => r.userId);
      expect(own(await tx.select({ userId: session.userId }).from(session))).toEqual([U1]);
      expect(own(await tx.select({ userId: account.userId }).from(account))).toEqual([U1]);
      expect(own(await tx.select({ userId: twoFactor.userId }).from(twoFactor))).toEqual([U1]);
    });
  });

  it('reads no identity row without a signed-in person', async () => {
    const { rows } = await withoutTenant(testDb(), (tx) =>
      tx.execute<{ n: number }>(sql`select count(*)::int as n from "user"`),
    );
    expect(rows[0]?.n).toBe(0);
  });

  it.each([
    ['session token', sql`select token from session`],
    ['account password', sql`select password from account`],
    ['two-factor secret', sql`select secret from two_factor`],
    ['verification', sql`select id from verification`],
    ['auth_throttle', sql`select key_hash from auth_throttle`],
  ])('cannot read %s', async (_what, query) => {
    await expect(asU1((tx) => tx.execute(query))).rejects.toThrow(/permission denied/);
  });

  it.each([
    ['update user', sql`update "user" set name = 'x'`],
    ['delete session', sql`delete from session`],
    ['update two_factor', sql`update two_factor set verified = false`],
  ])('cannot write identity tables (%s)', async (_what, query) => {
    await expect(asU1((tx) => tx.execute(query))).rejects.toThrow(/permission denied/);
  });
});

describe('shifa_auth', () => {
  it('reaches every identity row (the Better Auth adapter path)', async () => {
    await testAuthDb().withAuth(async (tx) => {
      expect(ids(await tx.select({ id: user.id }).from(user))).toEqual([U1, U2].sort());
      expect(await tx.select({ id: verification.id }).from(verification)).toHaveLength(1);
      expect(await tx.select({ kind: authThrottle.kind }).from(authThrottle)).toHaveLength(1);
      await tx.update(user).set({ name: 'اسم جديد' });
    });
  });

  it("reads one person's own memberships across tenants and nothing else", async () => {
    const rows = await testAuthDb().withUser(U1, (tx) =>
      tx.execute<{ tenant_id: string; user_id: string }>(
        sql`select tenant_id, user_id from membership order by tenant_id`,
      ),
    );
    expect(rows.rows).toEqual(
      [T1, T2].sort().map((tenantId) => ({ tenant_id: tenantId, user_id: U1 })),
    );
  });

  it('reads the tenants of those memberships only', async () => {
    const { rows } = await testAuthDb().withUser(U1, (tx) =>
      tx.execute<{ id: string }>(sql`select id from tenant`),
    );
    expect(ids(rows)).toEqual([T1, T2].sort());
  });

  it('reads no membership, tenant or setup link without a person or link', async () => {
    const { rows } = await testAuthDb().withAuth((tx) =>
      tx.execute<{ m: number; t: number; l: number }>(sql`
        select (select count(*)::int from membership) as m, (select count(*)::int from tenant) as t,
               (select count(*)::int from setup_link) as l`),
    );
    expect(rows[0]).toEqual({ m: 0, t: 0, l: 0 });
  });

  it('reads exactly one setup link by its token hash and marks it used', async () => {
    const auth = testAuthDb();
    await auth.withSetupLink(HASH_1, async (tx) => {
      const { rows } = await tx.execute<{ tenant_id: string }>(
        sql`select tenant_id from setup_link`,
      );
      expect(rows).toEqual([{ tenant_id: T1 }]);
      const updated = await tx.execute(sql`update setup_link set used_at = now()`);
      expect(updated.rowCount).toBe(1);
    });
    await expect(
      auth.withSetupLink(HASH_1, (tx) => tx.execute(sql`update setup_link set expires_at = now()`)),
    ).rejects.toThrow(/permission denied/);
  });

  it.each([
    ['branch', sql`select id from branch`],
    ['role_assignment', sql`select id from role_assignment`],
    ['organization', sql`select id from organization`],
    ['audit_event', sql`select id from audit_event`],
    ['membership update', sql`update membership set display_name = 'x'`],
  ])('has no privilege on %s', async (_what, query) => {
    await expect(testAuthDb().withUser(U1, (tx) => tx.execute(query))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('writes audit events with a null tenant only', async () => {
    const auth = testAuthDb();
    await auth.withAuth((tx) =>
      tx.execute(
        sql`insert into audit_event (event, actor_id) values ('auth.sign_in_failed', null)`,
      ),
    );
    await expect(
      auth.withUser(U1, (tx) =>
        tx.execute(
          sql`insert into audit_event (tenant_id, event, actor_id) values (${T1}, 'auth.sign_in', ${U1})`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('rejects a malformed user id or token hash before any SQL is sent', async () => {
    const auth = testAuthDb();
    await expect(auth.withUser('nope', () => Promise.resolve())).rejects.toThrow(/UUID/);
    await expect(auth.withSetupLink('AB', () => Promise.resolve())).rejects.toThrow(/hash/);
  });
});
