// The auth and platform wrappers (A-01-01, ADR-0043): each pool connects as its own role only,
// every wrapper sets or clears every `app.*` setting transaction-locally (so a session-level
// value left on a pooled connection never applies), and ping() checks the role without any
// context.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createAuthDb, createDb, createPlatformDb, type Tx } from '../src/index.ts';
import {
  fixtureId,
  harnessUrl,
  testAuthDb,
  testDb,
  testPlatformDb,
} from '../test-harness/index.ts';

const TENANT = fixtureId('wrapper tenant');
const USER = fixtureId('wrapper user');
const ADMIN = fixtureId('wrapper admin');
const HASH = 'c3'.repeat(32);

interface Settings extends Record<string, unknown> {
  tenant: string;
  branch: string;
  user: string;
  reason: string;
  link: string;
}

const readSettings = (tx: Tx) =>
  tx
    .execute<Settings>(sql`select coalesce(current_setting('app.tenant_id', true), '') as tenant,
                       coalesce(current_setting('app.branch_id', true), '') as branch,
                       coalesce(current_setting('app.user_id', true), '') as user,
                       coalesce(current_setting('app.admin_reason', true), '') as reason,
                       coalesce(current_setting('app.link_token_hash', true), '') as link`)
    .then((r) => r.rows[0]);

/** Leaves session-level values for every setting on the (single) pooled connection. */
const leaveSessionValues = (tx: Tx) =>
  tx.execute(sql`select set_config('app.tenant_id', ${TENANT}, false),
                        set_config('app.branch_id', ${TENANT}, false),
                        set_config('app.user_id', ${USER}, false),
                        set_config('app.admin_reason', 'left behind', false),
                        set_config('app.link_token_hash', ${HASH}, false)`);

const empty: Settings = { tenant: '', branch: '', user: '', reason: '', link: '' };

describe('auth wrappers', () => {
  it('withAuth clears every setting, withUser sets only the user, withSetupLink only the hash', async () => {
    const auth = createAuthDb(harnessUrl('auth'), { max: 1 });
    try {
      await auth.withAuth(leaveSessionValues);
      expect(await auth.withAuth(readSettings)).toEqual(empty);
      expect(await auth.withUser(USER, readSettings)).toEqual({ ...empty, user: USER });
      expect(await auth.withSetupLink(HASH, readSettings)).toEqual({ ...empty, link: HASH });
    } finally {
      await auth.close();
    }
  });

  it('refuses to connect as any role but shifa_auth', async () => {
    for (const role of ['app', 'platform', 'owner'] as const) {
      const wrong = createAuthDb(harnessUrl(role), { max: 1 });
      try {
        await expect(wrong.withAuth((tx) => tx.execute(sql`select 1`))).rejects.toThrow(
          /shifa_auth/,
        );
      } finally {
        await wrong.close();
      }
    }
  });
});

describe('platform wrapper', () => {
  it('clears every setting and names its event in app.admin_reason', async () => {
    const platform = createPlatformDb(harnessUrl('platform'), { max: 1 });
    const action = { actorId: ADMIN, event: 'clinic.created' } as const;
    try {
      await platform.withPlatformAdmin(action, leaveSessionValues);
      expect(await platform.withPlatformAdmin(action, readSettings)).toEqual({
        ...empty,
        reason: 'clinic.created',
      });
    } finally {
      await platform.close();
    }
  });

  it('refuses to connect as any role but shifa_platform', async () => {
    for (const role of ['app', 'auth', 'owner'] as const) {
      const wrong = createPlatformDb(harnessUrl(role), { max: 1 });
      try {
        await expect(
          wrong.withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, (tx) =>
            tx.execute(sql`select 1`),
          ),
        ).rejects.toThrow(/shifa_platform/);
      } finally {
        await wrong.close();
      }
    }
  });
});

describe('application pool', () => {
  it('withTenant clears the link hash a session left behind', async () => {
    const db = createDb(harnessUrl('app'), { max: 1 });
    try {
      await db.withTenant({ tenantId: TENANT, userId: USER }, leaveSessionValues);
      expect(await db.withTenant({ tenantId: TENANT, userId: USER }, readSettings)).toEqual({
        ...empty,
        tenant: TENANT,
        user: USER,
      });
    } finally {
      await db.close();
    }
  });

  it('refuses to connect as shifa_auth or shifa_platform', async () => {
    for (const role of ['auth', 'platform'] as const) {
      const wrong = createDb(harnessUrl(role), { max: 1 });
      try {
        await expect(wrong.ping()).rejects.toThrow(/shifa_app/);
      } finally {
        await wrong.close();
      }
    }
  });

  it('ping() answers without any tenant context (health probe)', async () => {
    await expect(testDb().ping()).resolves.toBeUndefined();
  });

  it('the shared test handles connect as their own roles', async () => {
    const who = (tx: Tx) =>
      tx.execute<{ u: string }>(sql`select current_user as u`).then((r) => r.rows[0]?.u);
    expect(await testDb().withTenant({ tenantId: TENANT, userId: USER }, who)).toBe('shifa_app');
    expect(await testAuthDb().withAuth(who)).toBe('shifa_auth');
    expect(
      await testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, who),
    ).toBe('shifa_platform');
  });
});
