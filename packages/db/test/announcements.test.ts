// A-02 criteria 16, 17 and 22 (A-02-07) at the database. Announcements are platform rows:
// shifa_platform writes them only in their actions; shifa_app reads only the ones aimed at its
// clinic (every clinic, or a target row of its own; the API picks the active ones by its clock), a
// few columns only, and writes none. A
// dismissal is the person's own (app.user_id), for an announcement they can see, never deleted.
// usage_daily is the clinic's: shifa_app writes its own rows; shifa_platform reads every clinic's
// only in the clinics list and the usage view. announcement_counts() and clinic_member_counts()
// give integers only, in their actions only, and leave the caller's settings as they were.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { announcementCounts, clinicMemberCounts } from '../src/index.ts';
import {
  announcement,
  announcementDismissal,
  announcementTarget,
  membership,
  usageDaily,
  user,
} from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  rawAppDb,
  superuserDb,
  syntheticPhones,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('announcements tenant A');
const B = fixtureId('announcements tenant B');
const ADMIN = fixtureId('announcements admin');
const ALL = fixtureId('announcement all');
const FOR_A = fixtureId('announcement for A');
const FOR_B = fixtureId('announcement for B');
const LATER = fixtureId('announcement later');
const ENDED = fixtureId('announcement ended');
const su = () => superuserDb(workerDatabaseName());
const code = (err: unknown) =>
  (err as { code?: string; cause?: { code?: string } }).code ??
  (err as { cause?: { code?: string } }).cause?.code;

async function refused(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (err) {
    return code(err);
  }
  return undefined;
}

const HOUR = 3_600_000;
const at = (offset: number) => new Date(Date.now() + offset);
const PHONES = syntheticPhones(2026_12_10, 6);

/** A membership written as the superuser: active with an account, pending without. */
async function member(tenantId: string, phone: string, userId?: string): Promise<string> {
  const id = randomUUID();
  await su()
    .insert(membership)
    .values({
      id,
      tenantId,
      userId: userId ?? null,
      phoneE164: phone,
      displayName: 'موظف تجريبي',
      status: userId ? 'active' : 'pending',
    });
  return id;
}
let personA: string;
let personB: string;

function row(id: string, target: 'all' | 'selected', startsAt: Date, endsAt: Date | null = null) {
  return {
    id,
    body: 'إعلان تجريبي',
    level: 'info' as const,
    startsAt,
    endsAt,
    target,
    createdBy: ADMIN,
    createdByName: 'مشرف تجريبي',
  };
}

beforeEach(async () => {
  await createTestTenants(A, B);
  await su()
    .insert(announcement)
    .values([
      row(ALL, 'all', at(-HOUR)),
      row(FOR_A, 'selected', at(-HOUR), at(HOUR)),
      row(FOR_B, 'selected', at(-HOUR)),
      row(LATER, 'all', at(HOUR)),
      row(ENDED, 'all', at(-2 * HOUR), at(-HOUR)),
    ]);
  await su()
    .insert(announcementTarget)
    .values([
      { tenantId: A, announcementId: FOR_A },
      { tenantId: B, announcementId: FOR_B },
    ]);
  personA = randomUUID();
  personB = randomUUID();
  for (const [index, [person, tenantId]] of (
    [
      [personA, A],
      [personB, B],
    ] as const
  ).entries()) {
    const phone = PHONES[index] ?? '';
    await su()
      .insert(user)
      .values({
        id: person,
        name: 'شخص تجريبي',
        email: `${person}@example.invalid`,
        phoneNumber: phone,
      });
    await member(tenantId, phone, person);
  }
});

describe('what a clinic reads', () => {
  // Which of them are active is the API's call, by its clock (as every time rule of the API).
  it('only the announcements aimed at it: every clinic, or its own target rows', async () => {
    const seen = await testDb().withTenant({ tenantId: A, userId: personA }, (tx) =>
      tx.select({ id: announcement.id }).from(announcement),
    );
    expect(seen.map((r) => r.id).sort()).toEqual([ALL, FOR_A, LATER, ENDED].sort());
    const none = await testDb().withTenant({ tenantId: B, userId: personB }, (tx) =>
      tx.select({ id: announcement.id }).from(announcement),
    );
    expect(none.map((r) => r.id).sort()).toEqual([ALL, FOR_B, LATER, ENDED].sort());
  });

  it('a few columns only, never who wrote it', async () => {
    expect(
      await refused(() =>
        testDb().withTenant({ tenantId: A, userId: personA }, (tx) =>
          tx.execute(sql`select created_by_name from announcement`),
        ),
      ),
    ).toBe('42501');
  });

  it('nothing without a clinic set', async () => {
    const { rows } = await rawAppDb().execute(sql`select id from announcement`);
    expect(rows).toEqual([]);
  });

  it('writes no announcement and no target', async () => {
    for (const statement of [
      sql`insert into announcement (body, level, starts_at, target, created_by)
            values ('x', 'info', now(), 'all', ${ADMIN})`,
      sql`update announcement set body = 'y'`,
      sql`delete from announcement`,
      sql`insert into announcement_target (tenant_id, announcement_id) values (${A}, ${ALL})`,
      sql`delete from announcement_target`,
    ]) {
      expect(
        await refused(() =>
          testDb().withTenant({ tenantId: A, userId: personA }, (tx) => tx.execute(statement)),
        ),
      ).toBe('42501');
    }
  });
});

describe('dismissals', () => {
  it('a person writes and reads their own, for an announcement they can see', async () => {
    await testDb().withTenant({ tenantId: A, userId: personA }, (tx) =>
      tx.insert(announcementDismissal).values({ userId: personA, announcementId: ALL, version: 1 }),
    );
    const own = await testDb().withTenant({ tenantId: B, userId: personA }, (tx) =>
      tx.select().from(announcementDismissal),
    );
    expect(own).toHaveLength(1);
    const other = await testDb().withTenant({ tenantId: B, userId: personB }, (tx) =>
      tx.select().from(announcementDismissal),
    );
    expect(other).toEqual([]);
  });

  it('never for someone else, another clinic’s announcement or a version above the current', async () => {
    for (const values of [
      { userId: personB, announcementId: ALL, version: 1 },
      { userId: personA, announcementId: FOR_B, version: 1 },
      { userId: personA, announcementId: ALL, version: 2 },
    ]) {
      expect(
        await refused(() =>
          testDb().withTenant({ tenantId: A, userId: personA }, (tx) =>
            tx.insert(announcementDismissal).values(values),
          ),
        ),
        JSON.stringify(values),
      ).toBe('42501');
    }
  });

  it('is never deleted by the clinic path', async () => {
    expect(
      await refused(() =>
        testDb().withTenant({ tenantId: A, userId: personA }, (tx) =>
          tx.execute(sql`delete from announcement_dismissal`),
        ),
      ),
    ).toBe('42501');
  });
});

describe('the platform', () => {
  it('writes announcements and targets only in their actions', async () => {
    const id = randomUUID();
    await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'announcement.created' },
      async (tx) => {
        await tx.insert(announcement).values(row(id, 'selected', new Date()));
        await tx.insert(announcementTarget).values({ tenantId: A, announcementId: id });
      },
    );
    expect(
      await refused(() =>
        testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.listed' }, (tx) =>
          tx.insert(announcement).values(row(randomUUID(), 'all', new Date())),
        ),
      ),
    ).toBe('42501');
    // Outside an edit or end the row is not there to update.
    const untouched = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'announcement.listed' },
      (tx) => tx.execute(sql`update announcement set body = 'x' where id = ${id}`),
    );
    expect(untouched.rowCount).toBe(0);
    const edited = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'announcement.edited' },
      (tx) => tx.execute(sql`update announcement set body = 'جديد' where id = ${id}`),
    );
    expect(edited.rowCount).toBe(1);
    const targets = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'announcement.listed' },
      (tx) => tx.select().from(announcementTarget),
    );
    expect(targets).toHaveLength(3);
    const elsewhere = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'clinic.listed' },
      (tx) => tx.select().from(announcementTarget),
    );
    expect(elsewhere).toEqual([]);
  });

  it('deletes no announcement and no dismissal', async () => {
    for (const statement of [
      sql`delete from announcement`,
      sql`delete from announcement_dismissal`,
    ]) {
      expect(
        await refused(() =>
          testPlatformDb().withPlatformAdmin(
            { actorId: ADMIN, event: 'announcement.ended' },
            (tx) => tx.execute(statement),
          ),
        ),
      ).toBe('42501');
    }
  });

  it('counts targeted members and dismissals as integers, in announcement actions only', async () => {
    await testDb().withTenant({ tenantId: A, userId: personA }, (tx) =>
      tx.insert(announcementDismissal).values({ userId: personA, announcementId: ALL, version: 1 }),
    );
    // A pending member counts as targeted; a deactivated one does not.
    await member(A, PHONES[2] ?? '');
    const off = await member(B, PHONES[3] ?? '');
    await su().execute(sql`update membership set status = 'deactivated' where id = ${off}`);
    const items = [
      { id: ALL, version: 1, all: true },
      { id: FOR_A, version: 1, all: false },
      { id: FOR_B, version: 1, all: false },
    ];
    const counts = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'announcement.listed' },
      async (tx) => {
        const before = await tx.execute<{ t: string; u: string }>(
          sql`select current_setting('app.tenant_id', true) as t, current_setting('app.user_id', true) as u`,
        );
        const result = await announcementCounts(tx, items);
        const after = await tx.execute<{ t: string; u: string }>(
          sql`select current_setting('app.tenant_id', true) as t, current_setting('app.user_id', true) as u`,
        );
        expect(after.rows).toEqual(before.rows);
        return result;
      },
    );
    expect(counts.get(ALL)).toEqual({ targeted: 3, dismissed: 1 });
    expect(counts.get(FOR_A)).toEqual({ targeted: 2, dismissed: 0 });
    expect(counts.get(FOR_B)).toEqual({ targeted: 1, dismissed: 0 });
    // A dismissal of an older version is not counted.
    const v2 = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'announcement.listed' },
      (tx) => announcementCounts(tx, [{ id: ALL, version: 2, all: true }]),
    );
    expect(v2.get(ALL)).toEqual({ targeted: 3, dismissed: 0 });
    expect(
      await refused(() =>
        testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.listed' }, (tx) =>
          announcementCounts(tx, items),
        ),
      ),
    ).toBe('42501');
  });

  it('counts a clinic’s members and branches, in the usage view only', async () => {
    const counts = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'clinic.usage_viewed' },
      (tx) => clinicMemberCounts(tx, A),
    );
    expect(counts).toEqual({ members: 1, activeMembers: 1, branches: 0 });
    expect(
      await refused(() =>
        testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.listed' }, (tx) =>
          clinicMemberCounts(tx, A),
        ),
      ),
    ).toBe('42501');
  });
});

describe('usage_daily', () => {
  const day = '2026-12-02';
  it('shifa_app writes and reads its own clinic’s rows', async () => {
    await testDb().withTenant({ tenantId: A, userId: personA }, (tx) =>
      tx.insert(usageDaily).values({ tenantId: A, day, key: 'sign_ins', value: 2 }),
    );
    expect(
      await refused(() =>
        testDb().withTenant({ tenantId: A, userId: personA }, (tx) =>
          tx.insert(usageDaily).values({ tenantId: B, day, key: 'sign_ins', value: 2 }),
        ),
      ),
    ).toBe('42501');
    const own = await testDb().withTenant({ tenantId: B, userId: personB }, (tx) =>
      tx.select().from(usageDaily),
    );
    expect(own).toEqual([]);
  });

  it('refuses a negative value or a malformed key', async () => {
    for (const values of [
      { tenantId: A, day, key: 'sign_ins', value: -1 },
      { tenantId: A, day, key: 'Sign-Ins', value: 1 },
    ]) {
      expect(
        await refused(() =>
          testDb().withTenant({ tenantId: A, userId: personA }, (tx) =>
            tx.insert(usageDaily).values(values),
          ),
        ),
      ).toBe('23514');
    }
  });

  it('shifa_platform reads every clinic’s rows in the clinics list and usage view only, writes none', async () => {
    await su()
      .insert(usageDaily)
      .values([
        { tenantId: A, day, key: 'sign_ins', value: 1 },
        { tenantId: B, day, key: 'sign_ins', value: 4 },
      ]);
    for (const event of ['clinic.listed', 'clinic.usage_viewed'] as const) {
      const rows = await testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) =>
        tx.select().from(usageDaily),
      );
      expect(rows).toHaveLength(2);
    }
    const elsewhere = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'clinic.viewed' },
      (tx) => tx.select().from(usageDaily),
    );
    expect(elsewhere).toEqual([]);
    expect(
      await refused(() =>
        testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'clinic.listed' }, (tx) =>
          tx.execute(sql`update usage_daily set value = 0`),
        ),
      ),
    ).toBe('42501');
  });
});
