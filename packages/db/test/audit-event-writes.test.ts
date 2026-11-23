// audit_event keeps every row through refused writes (A-01a criterion 14, A-01-01 review): the
// writes run inside this test, then the rows are compared with what was there before.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { auditEvent } from '../src/index.ts';
import {
  createTestTenants,
  fixtureId,
  ownerDb,
  superuserDb,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const TENANT = fixtureId('audit writes tenant');
const USER = fixtureId('audit writes user');
const ADMIN = fixtureId('audit writes admin');

async function snapshot(): Promise<string[]> {
  const { rows } = await superuserDb(workerDatabaseName()).execute<{ r: string }>(
    sql`select format('%s|%s|%s|%s', id, tenant_id, event, at) as r from audit_event order by 1`,
  );
  return rows.map((r) => r.r);
}

describe('audit_event after refused writes', () => {
  it('holds exactly the rows it held before', async () => {
    await createTestTenants(TENANT);
    await testDb().withTenant({ tenantId: TENANT, userId: USER }, (tx) =>
      tx.insert(auditEvent).values({ tenantId: TENANT, actorId: USER, event: 'member.added' }),
    );
    const before = await snapshot();
    expect(before.length).toBeGreaterThanOrEqual(2);

    const attempts: (() => Promise<unknown>)[] = [];
    for (const query of [
      sql`update audit_event set event = 'member.removed'`,
      sql`delete from audit_event`,
    ]) {
      attempts.push(
        () => testDb().withTenant({ tenantId: TENANT, userId: USER }, (tx) => tx.execute(query)),
        () => testAuthDb().withAuth((tx) => tx.execute(query)),
        () =>
          testPlatformDb().withPlatformAdmin(
            { actorId: ADMIN, event: 'clinic.status_changed' },
            (tx) => tx.execute(query),
          ),
        () => ownerDb().execute(query),
      );
    }
    for (const attempt of attempts) await expect(attempt()).rejects.toThrow();

    expect(await snapshot()).toEqual(before);
  });
});
