// audit_event (A-01a criterion 14, A-01-01): append-only for every application role, and even
// for the owner through a trigger; platform events (null tenant) invisible to shifa_app; one
// audit row per withPlatformAdmin() call, written in the same transaction as the work.
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvent } from '../src/index.ts';
import {
  createTestTenants,
  fixtureId,
  ownerDb,
  superuserDb,
  testAuthDb,
  testDb,
  testPlatformDb,
  withoutTenant,
  workerDatabaseName,
} from '../test-harness/index.ts';

const T1 = fixtureId('audit tenant 1');
const T2 = fixtureId('audit tenant 2');
const ADMIN = fixtureId('audit super admin');
const USER = fixtureId('audit user');

interface AuditRow extends Record<string, unknown> {
  tenant_id: string | null;
  actor_id: string | null;
  target_id: string | null;
  event: string;
  request_id: string | null;
}

/** Every audit row, read past RLS as the container superuser (tests only). */
async function allAuditRows(): Promise<AuditRow[]> {
  const { rows } = await superuserDb(workerDatabaseName()).execute<AuditRow>(
    sql`select tenant_id, actor_id, target_id, event, request_id from audit_event order by at, event`,
  );
  return rows;
}

beforeEach(async () => {
  await createTestTenants(T1, T2);
  await ownerDb().execute(sql`truncate audit_event`);
  for (const tenantId of [T1, T2]) {
    await testDb().withTenant({ tenantId, userId: USER }, (tx) =>
      tx.insert(auditEvent).values({ tenantId, actorId: USER, event: 'member.added' }),
    );
  }
  await testAuthDb().withAuth((tx) =>
    tx.insert(auditEvent).values({ actorId: null, event: 'auth.sign_in_failed' }),
  );
});

describe('audit_event is append-only', () => {
  const writes = [
    ['update', sql`update audit_event set event = 'member.removed'`],
    ['delete', sql`delete from audit_event`],
  ] as const;

  it.each(writes)('shifa_app cannot %s', async (_what, query) => {
    await expect(
      testDb().withTenant({ tenantId: T1, userId: USER }, (tx) => tx.execute(query)),
    ).rejects.toThrow(/permission denied for table audit_event/);
  });

  it.each(writes)('shifa_auth cannot %s', async (_what, query) => {
    await expect(testAuthDb().withAuth((tx) => tx.execute(query))).rejects.toThrow(
      /permission denied for table audit_event/,
    );
  });

  it.each(writes)('shifa_platform cannot %s', async (_what, query) => {
    await expect(
      testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.status_changed' }, (tx) =>
        tx.execute(query),
      ),
    ).rejects.toThrow(/permission denied for table audit_event/);
  });

  it.each(writes)('even the owner cannot %s (trigger)', async (_what, query) => {
    await expect(ownerDb().execute(query)).rejects.toThrow(/append-only/);
  });

  it('keeps every row after the refused writes', async () => {
    expect(await allAuditRows()).toHaveLength(3);
  });
});

describe('audit_event visibility', () => {
  it("shows a tenant only its own rows, never a platform row's null tenant", async () => {
    const { rows } = await testDb().withTenant({ tenantId: T1, userId: USER }, (tx) =>
      tx.execute<{ tenant_id: string | null }>(sql`select tenant_id from audit_event`),
    );
    expect(rows).toEqual([{ tenant_id: T1 }]);
    const nulls = await testDb().withTenant({ tenantId: T1, userId: USER }, (tx) =>
      tx.execute(sql`select 1 from audit_event where tenant_id is null`),
    );
    expect(nulls.rows).toEqual([]);
  });

  it('shows nothing without a tenant context', async () => {
    const { rows } = await withoutTenant(testDb(), (tx) =>
      tx.execute(sql`select 1 from audit_event`),
    );
    expect(rows).toEqual([]);
  });

  it("refuses a tenant's insert of a platform (null tenant) row", async () => {
    await expect(
      testDb().withTenant({ tenantId: T1, userId: USER }, (tx) =>
        tx.insert(auditEvent).values({ tenantId: null, actorId: USER, event: 'member.added' }),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('refuses an event name outside the dotted lower-case form', async () => {
    await expect(
      testDb().withTenant({ tenantId: T1, userId: USER }, (tx) =>
        tx.insert(auditEvent).values({ tenantId: T1, actorId: USER, event: 'Member Added' }),
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('refuses a data payload that is not a small object', async () => {
    await expect(
      testDb().withTenant({ tenantId: T1, userId: USER }, (tx) =>
        tx.insert(auditEvent).values({
          tenantId: T1,
          actorId: USER,
          event: 'member.added',
          data: { note: 'x'.repeat(2000) },
        }),
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });
});

describe('withPlatformAdmin() audit', () => {
  it('writes one null-tenant row per call with actor, event, target and request id', async () => {
    await ownerDb().execute(sql`truncate audit_event`);
    const target = fixtureId('audit target');
    await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'owner.sessions_ended', requestId: 'req-1' },
      async (tx, audit) => {
        await tx.execute(sql`select 1`);
        audit.setTarget(target);
      },
    );
    expect(await allAuditRows()).toEqual([
      {
        tenant_id: null,
        actor_id: ADMIN,
        target_id: target,
        event: 'owner.sessions_ended',
        request_id: 'req-1',
      },
    ]);
  });

  it('leaves no audit row when the work rolls back', async () => {
    await ownerDb().execute(sql`truncate audit_event`);
    await expect(
      testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.created' }, () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await allAuditRows()).toEqual([]);
  });

  it('refuses a malformed actor or request id before any SQL is sent', async () => {
    const platform = testPlatformDb();
    const noop = () => Promise.resolve();
    await expect(
      platform.withPlatformAdmin({ actorId: 'admin', event: 'clinic.created' }, noop),
    ).rejects.toThrow(/actorId/);
    await expect(
      platform.withPlatformAdmin(
        { actorId: ADMIN, event: 'clinic.created', requestId: 'bad id\n' },
        noop,
      ),
    ).rejects.toThrow(/requestId/);
  });
});
