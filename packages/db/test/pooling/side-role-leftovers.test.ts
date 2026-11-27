// Session leftovers on the auth and platform pools (A-01-01 review): PgBouncer pools server
// connections per (database, user), so a shifa_app leftover never reaches them, but a raw
// shifa_auth or shifa_platform client can leave session-level `app.*` values on its own server
// connection. On that same connection (POOLING_DATABASE, server pool 1) the wrappers must still
// see only what they set themselves.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuthDb, createPlatformDb, type Tx } from '../../src/index.ts';
import {
  fixtureId,
  holdPoolingDatabase,
  ownerDb,
  POOLING_DATABASE,
  pooledHarnessUrl,
  rawPooledSession,
} from '../../test-harness/index.ts';

const TENANT = fixtureId('side leftover tenant');
const USER = fixtureId('side leftover user');
const ADMIN = fixtureId('side leftover admin');
const HASH = '9a'.repeat(32);

let release: (() => Promise<void>) | undefined;

beforeAll(async () => {
  release = await holdPoolingDatabase();
});

afterAll(async () => {
  try {
    for (const role of ['auth', 'platform'] as const) {
      const raw = await rawPooledSession(POOLING_DATABASE, { role });
      await raw.query('RESET ALL');
      await raw.end();
    }
    // The platform wrapper wrote audit rows here; POOLING_DATABASE is never truncated for us.
    await ownerDb(POOLING_DATABASE).execute(sql`truncate audit_event`);
  } finally {
    await release?.();
  }
});

/** A raw client of `role` leaves every `app.*` setting at session level, then disconnects. */
async function leaveSessionValues(role: 'auth' | 'platform'): Promise<number> {
  const raw = await rawPooledSession(POOLING_DATABASE, { role });
  try {
    const rows = await raw.query<{ pid: number }>(
      `select set_config('app.tenant_id', $1, false), set_config('app.branch_id', $1, false),
              set_config('app.user_id', $2, false), set_config('app.admin_reason', 'left', false),
              set_config('app.link_token_hash', $3, false), pg_backend_pid() as pid`,
      [TENANT, USER, HASH],
    );
    return Number(rows[0]?.pid);
  } finally {
    await raw.end();
  }
}

const view = (tx: Tx) =>
  tx
    .execute<{ pid: number; t: string; u: string; r: string; l: string }>(sql`
      select pg_backend_pid() as pid,
             coalesce(current_setting('app.tenant_id', true), '') as t,
             coalesce(current_setting('app.user_id', true), '') as u,
             coalesce(current_setting('app.admin_reason', true), '') as r,
             coalesce(current_setting('app.link_token_hash', true), '') as l`)
    .then((res) => res.rows[0]);

describe('side-role pools behind PgBouncer', () => {
  it('auth wrappers override a session-level leftover on the same server connection', async () => {
    const pid = await leaveSessionValues('auth');
    const auth = createAuthDb(pooledHarnessUrl('auth', POOLING_DATABASE), { max: 1 });
    try {
      expect(await auth.withAuth(view)).toEqual({ pid, t: '', u: '', r: '', l: '' });
      const other = fixtureId('side leftover other user');
      expect(await auth.withUser(other, view)).toEqual({ pid, t: '', u: other, r: '', l: '' });
    } finally {
      await auth.close();
    }
  });

  it('withPlatformAdmin overrides a session-level leftover on the same server connection', async () => {
    const pid = await leaveSessionValues('platform');
    const platform = createPlatformDb(pooledHarnessUrl('platform', POOLING_DATABASE), { max: 1 });
    try {
      expect(
        await platform.withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, view),
        // app.user_id is the acting super admin since A-02-05 (review 5), never a leftover.
      ).toEqual({ pid, t: '', u: ADMIN, r: 'clinic.created', l: '' });
    } finally {
      await platform.close();
    }
  });
});
