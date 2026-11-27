// A-01-04 database rules: an invitation binds its membership only to the signed-in person whose
// phone it was sent to, and only once its link is used (withUserLink); shifa_app can no longer
// bind a membership to an account itself (A-01-01 review L4, A-01-03 M2); a clinic writes
// nothing on `tenant` (A-02-06: its idle setting is in the cascade); the auth path reads a person's own role
// assignments across clinics (MFA gate before a clinic is chosen) and nobody else's.

import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { roleAssignment } from '../src/schema/index.ts';
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

const TENANT_A = fixtureId('team-policies tenant a');
const TENANT_B = fixtureId('team-policies tenant b');
const SEEDER = fixtureId('team-policies seeder');
const INVITED = fixtureId('team-policies invited user');
const STRANGER = fixtureId('team-policies stranger');
const MEMBER = fixtureId('team-policies invited membership');
const ACTIVE = fixtureId('team-policies active membership');
const HASH = 'c3'.repeat(32);
const [INVITED_PHONE = '', STRANGER_PHONE = ''] = syntheticPhones(7801, 2);

async function membershipOf(id: string) {
  const { rows } = await superuserDb(workerDatabaseName()).execute<{
    user_id: string | null;
    status: string;
  }>(sql`select user_id, status from membership where id = ${id}`);
  return rows[0];
}

/** SQLSTATE of the error `fn` rejects with (Drizzle wraps the pg error as its cause). */
async function sqlState(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
    return undefined;
  } catch (err) {
    const cause = (err as { cause?: { code?: string }; code?: string }).cause;
    return cause?.code ?? (err as { code?: string }).code;
  }
}

beforeEach(async () => {
  await createTestTenants(TENANT_A, TENANT_B);
  await testAuthDb().withAuth(async (tx) => {
    await insertUser(tx, { id: INVITED, phone: INVITED_PHONE });
    await insertUser(tx, { id: STRANGER, phone: STRANGER_PHONE });
  });
  // The invited person is an active doctor in A; B invites them.
  await testDb().withTenant({ tenantId: TENANT_A, userId: SEEDER }, async (tx) => {
    await insertMembership(tx, {
      id: ACTIVE,
      tenantId: TENANT_A,
      phone: INVITED_PHONE,
      userId: INVITED,
    });
    await tx
      .insert(roleAssignment)
      .values({ tenantId: TENANT_A, membershipId: ACTIVE, role: 'doctor' });
  });
  await testDb().withTenant({ tenantId: TENANT_B, userId: SEEDER }, async (tx) => {
    await insertMembership(tx, { id: MEMBER, tenantId: TENANT_B, phone: INVITED_PHONE });
    await tx.execute(sql`insert into setup_link (tenant_id, membership_id, purpose, token_hash, expires_at)
      values (${TENANT_B}, ${MEMBER}, 'invitation', ${HASH}, now() + interval '72 hours')`);
  });
});

const useLink = (userId: string) =>
  testAuthDb().withUserLink(userId, HASH, (tx) =>
    tx.execute(sql`update setup_link set used_at = now() where used_at is null`),
  );
const bind = (userId: string, as: string = userId) =>
  testAuthDb().withUserLink(userId, HASH, (tx) =>
    tx.execute(
      sql`update membership set user_id = ${as}, status = 'active', updated_at = now() where id = ${MEMBER}`,
    ),
  );

describe('accepting an invitation on the auth path', () => {
  it('binds the membership to the invited person once the link is used', async () => {
    await useLink(INVITED);
    expect((await bind(INVITED)).rowCount).toBe(1);
    expect(await membershipOf(MEMBER)).toEqual({ user_id: INVITED, status: 'active' });
  });

  it('does not bind before the link is used', async () => {
    expect((await bind(INVITED)).rowCount).toBe(0);
    expect(await membershipOf(MEMBER)).toEqual({ user_id: null, status: 'pending' });
  });

  it('refuses another signed-in person, and binding to someone else', async () => {
    await useLink(STRANGER);
    expect(await sqlState(() => bind(STRANGER))).toBe('42501');
    expect(await sqlState(() => bind(INVITED, STRANGER))).toBe('42501');
    expect(await membershipOf(MEMBER)).toEqual({ user_id: null, status: 'pending' });
  });
});

describe('shifa_app and the account binding', () => {
  it('cannot set membership.user_id (42501), can still change status', async () => {
    const state = await sqlState(() =>
      testDb().withTenant({ tenantId: TENANT_B, userId: SEEDER }, (tx) =>
        tx.execute(sql`update membership set user_id = ${STRANGER} where id = ${MEMBER}`),
      ),
    );
    expect(state).toBe('42501');
    const changed = await testDb().withTenant({ tenantId: TENANT_A, userId: SEEDER }, (tx) =>
      tx.execute(
        sql`update membership set status = 'deactivated', updated_at = now() where id = ${ACTIVE}`,
      ),
    );
    expect(changed.rowCount).toBe(1);
  });
});

// A-02-06: the idle setting lives in the cascade (A-02-04); its column, its column grant and the
// policy tenant_app_settings are gone, so the clinic writes nothing on its tenant row.
describe('the clinic’s tenant row', () => {
  it('shifa_app cannot update it at all', async () => {
    for (const statement of [
      sql`update tenant set updated_at = now() where id = ${TENANT_A}`,
      sql`update tenant set status = 'active' where id = ${TENANT_A}`,
    ]) {
      const state = await sqlState(() =>
        testDb().withTenant({ tenantId: TENANT_A, userId: SEEDER }, (tx) => tx.execute(statement)),
      );
      expect(state).toBe('42501');
    }
  });
});

describe('own role assignments on the auth path', () => {
  it('a person reads their own roles in every clinic, nobody else’s', async () => {
    const own = await testAuthDb().withUser(INVITED, (tx) =>
      tx.execute<{ role: string }>(sql`select role from role_assignment`),
    );
    expect(own.rows).toEqual([{ role: 'doctor' }]);
    const stranger = await testAuthDb().withUser(STRANGER, (tx) =>
      tx.execute(sql`select role from role_assignment`),
    );
    expect(stranger.rows).toEqual([]);
    const anonymous = await testAuthDb().withAuth((tx) =>
      tx.execute(sql`select role from role_assignment`),
    );
    expect(anonymous.rows).toEqual([]);
  });
});
