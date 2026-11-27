// A-02-07 security review at the database: S2, each platform action keeps to its columns (an end
// sets only the end and who ended it, once; an edit never touches who ended it and moves the
// version by one at most); N1, a cancelled announcement (ended before its start) is out of the
// clinic's reach.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { announcement } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  superuserDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('announcement review tenant');
const ADMIN = fixtureId('announcement review admin');
const HOUR = 3_600_000;
let id: string;

async function refused(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e.code ?? e.cause?.code;
  }
  return undefined;
}

const inAction = (
  event: 'announcement.edited' | 'announcement.ended',
  statement: ReturnType<typeof sql>,
) => testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) => tx.execute(statement));

beforeEach(async () => {
  await createTestTenants(A);
  id = randomUUID();
  await superuserDb(workerDatabaseName())
    .insert(announcement)
    .values({
      id,
      body: 'إعلان للمراجعة',
      level: 'info',
      startsAt: new Date(Date.now() - HOUR),
      target: 'all',
      createdBy: ADMIN,
    });
});

describe('each action keeps to its columns (S2)', () => {
  it('an end sets only the end and who ended it', async () => {
    for (const set of [
      sql`body = 'نص آخر'`,
      sql`version = version + 1`,
      sql`level = 'warning'`,
      sql`target = 'selected'`,
      sql`starts_at = now() - interval '2 hours'`,
    ]) {
      expect(
        await refused(() =>
          inAction(
            'announcement.ended',
            sql`update announcement set ${set}, ends_at = now(), ended_early = true,
                  ended_by = ${ADMIN}, updated_at = now() where id = ${id}`,
          ),
        ),
      ).toBe('42501');
    }
    expect(
      await refused(() =>
        inAction(
          'announcement.ended',
          sql`update announcement set ends_at = now() + interval '1 day', ended_early = true,
                ended_by = ${ADMIN}, updated_at = now() where id = ${id}`,
        ),
      ),
    ).toBe('42501');
    const ended = await inAction(
      'announcement.ended',
      sql`update announcement set ends_at = now(), ended_early = true, ended_by = ${ADMIN},
            ended_by_name = 'مشرف', updated_at = now() where id = ${id}`,
    );
    expect(ended.rowCount).toBe(1);
    // Never twice.
    expect(
      await refused(() =>
        inAction(
          'announcement.ended',
          sql`update announcement set ends_at = now(), updated_at = now() where id = ${id}`,
        ),
      ),
    ).toBe('42501');
  });

  it('an edit never reopens or names who ended, and moves the version by one at most', async () => {
    for (const set of [
      sql`ended_early = true, ended_by = ${ADMIN}, ends_at = now()`,
      sql`ended_by_name = 'أحد'`,
      sql`version = version + 2`,
    ]) {
      expect(
        await refused(() =>
          inAction(
            'announcement.edited',
            sql`update announcement set ${set}, updated_at = now() where id = ${id}`,
          ),
        ),
      ).toBe('42501');
    }
    const edited = await inAction(
      'announcement.edited',
      sql`update announcement set body = 'نص جديد', version = version + 1, updated_at = now()
            where id = ${id}`,
    );
    expect(edited.rowCount).toBe(1);
  });
});

describe('a cancelled announcement (N1)', () => {
  it('is out of the clinic’s reach; an ended one is not', async () => {
    const cancelled = randomUUID();
    await superuserDb(workerDatabaseName())
      .insert(announcement)
      .values({
        id: cancelled,
        body: 'أُلغي قبل بدئه',
        level: 'info',
        startsAt: new Date(Date.now() + HOUR),
        endsAt: new Date(),
        endedEarly: true,
        endedBy: ADMIN,
        target: 'all',
        createdBy: ADMIN,
      });
    const seen = await testDb().withTenant({ tenantId: A, userId: ADMIN }, (tx) =>
      tx.select({ id: announcement.id }).from(announcement),
    );
    expect(seen.map((r) => r.id)).toEqual([id]);
  });
});
