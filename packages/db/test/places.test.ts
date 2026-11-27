// A-02 criteria 15 and 24 (A-02-06) at the database: cities and areas are platform rows every
// application role but shifa_auth reads; shifa_app writes none; shifa_platform adds them only in
// their created action and changes them only in a rename, archive or restore of their kind (the
// trigger keeps each to its column, times bounded by now()); nobody deletes one. A branch's area
// belongs to its city. place_counts() gives integers only, across every clinic, in place actions
// only, and leaves the caller's tenant setting as it was.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { type PlatformEvent, placeCounts } from '../src/index.ts';
import { area, branch, city, membership, roleAssignment } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  rawAppDb,
  superuserDb,
  testAuthDb,
  testDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('places tenant A');
const B = fixtureId('places tenant B');
const ADMIN = fixtureId('places admin');
const ALEPPO = fixtureId('places city aleppo');
const AZAZ = fixtureId('places city azaz');
const SHAHBA = fixtureId('places area shahba');
const JAMILIYEH = fixtureId('places area jamiliyeh');
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

beforeEach(async () => {
  await createTestTenants(A, B);
  await su()
    .insert(city)
    .values([
      { id: ALEPPO, name: 'حلب', nameKey: 'حلب' },
      { id: AZAZ, name: 'أعزاز', nameKey: 'اعزاز' },
    ]);
  await su()
    .insert(area)
    .values([
      { id: SHAHBA, cityId: ALEPPO, name: 'الشهباء', nameKey: 'الشهباء' },
      { id: JAMILIYEH, cityId: ALEPPO, name: 'الجميلية', nameKey: 'الجميليه' },
    ]);
});

describe('who reads and writes places', () => {
  it('shifa_app and shifa_platform read them; shifa_auth does not', async () => {
    const own = await testDb().withTenant({ tenantId: A, userId: ADMIN }, (tx) =>
      tx.select({ id: city.id }).from(city),
    );
    expect(own).toHaveLength(2);
    const platform = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'city.listed' },
      (tx) => tx.select({ id: area.id }).from(area),
    );
    expect(platform).toHaveLength(2);
    expect(
      await refused(() => testAuthDb().withAuth((tx) => tx.select({ id: city.id }).from(city))),
    ).toBe('42501');
  });

  it('shifa_app writes no city or area', async () => {
    for (const statement of [
      sql`insert into city (name, name_key) values ('إدلب', 'ادلب')`,
      sql`update city set name = 'حلب الشهباء' where id = ${ALEPPO}`,
      sql`delete from city where id = ${AZAZ}`,
      sql`insert into area (city_id, name, name_key) values (${ALEPPO}, 'الحمدانية', 'الحمدانيه')`,
      sql`update area set archived_at = now() where id = ${SHAHBA}`,
      sql`delete from area where id = ${SHAHBA}`,
    ]) {
      expect(await refused(() => rawAppDb().execute(statement))).toBe('42501');
    }
  });

  it('shifa_platform adds a city only in city.created, not archived and created now', async () => {
    const add = (event: PlatformEvent, archivedAt = sql`null`) =>
      refused(() =>
        testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) =>
          tx.execute(sql`insert into city (name, name_key, archived_at)
                         values ('إدلب', ${`ادلب ${randomUUID().slice(0, 8)}`}, ${archivedAt})`),
        ),
      );
    expect(await add('city.created')).toBeUndefined();
    expect(await add('city.renamed')).toBe('42501');
    expect(await add('area.created')).toBe('42501');
    expect(await add('city.created', sql`now()`)).toBe('42501');
    expect(
      await refused(() =>
        testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'city.created' }, (tx) =>
          tx.execute(sql`insert into city (name, name_key, created_at)
                         values ('منبج', 'منبج', now() - interval '1 day')`),
        ),
      ),
    ).toBe('42501');
  });

  it('shifa_platform renames, archives and restores only in that action', async () => {
    const run = (event: PlatformEvent, statement: ReturnType<typeof sql>) =>
      refused(() =>
        testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) =>
          tx.execute(statement),
        ),
      );
    const rename = sql`update city set name = 'حلب الشهباء', name_key = 'حلب الشهباء',
                         updated_at = now() where id = ${ALEPPO}`;
    const archive = sql`update city set archived_at = now(), updated_at = now() where id = ${AZAZ}`;
    expect(await run('city.archived', rename)).toBe('42501');
    expect(await run('city.renamed', archive)).toBe('42501');
    // An area action reaches no city row at all.
    const crossed = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'area.renamed' },
      (tx) => tx.execute(rename),
    );
    expect(crossed.rowCount).toBe(0);
    expect(await run('city.renamed', rename)).toBeUndefined();
    expect(await run('city.archived', archive)).toBeUndefined();
    // Backdated or forward-dated archives are refused.
    expect(
      await run(
        'area.archived',
        sql`update area set archived_at = now() - interval '1 day', updated_at = now()
             where id = ${SHAHBA}`,
      ),
    ).toBe('42501');
    expect(
      await run(
        'city.restored',
        sql`update city set archived_at = null, updated_at = now() where id = ${AZAZ}`,
      ),
    ).toBeUndefined();
    // An area never moves to another city (no column grant).
    expect(
      await run('area.renamed', sql`update area set city_id = ${AZAZ} where id = ${SHAHBA}`),
    ).toBe('42501');
  });

  it('no role deletes a place', async () => {
    expect(
      await refused(() =>
        testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'city.archived' }, (tx) =>
          tx.execute(sql`delete from city where id = ${AZAZ}`),
        ),
      ),
    ).toBe('42501');
  });
});

describe('a branch’s place', () => {
  const setPlace = (cityId: string | null, areaId: string | null) =>
    refused(() =>
      testDb().withTenant({ tenantId: A, userId: ADMIN }, (tx) =>
        tx.insert(branch).values({ tenantId: A, name: 'فرع', cityId, areaId }),
      ),
    );

  it('takes a city, a city with one of its areas, or nothing', async () => {
    expect(await setPlace(ALEPPO, null)).toBeUndefined();
    expect(await setPlace(ALEPPO, SHAHBA)).toBeUndefined();
    expect(await setPlace(null, null)).toBeUndefined();
  });

  it('refuses an area of another city and an area without its city', async () => {
    expect(await setPlace(AZAZ, SHAHBA)).toBe('23503');
    expect(await setPlace(null, SHAHBA)).toBe('23514');
  });
});

/** A doctor of `tenantId`, clinic-wide (`branchId` null) or in one branch. */
async function doctor(tenantId: string, branchId: string | null, status = 'pending') {
  const id = randomUUID();
  await su()
    .insert(membership)
    .values({
      id,
      tenantId,
      phoneE164: `+9639${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      displayName: 'طبيب تجريبي',
      status: status as 'pending',
    });
  await su()
    .insert(roleAssignment)
    .values({ tenantId, membershipId: id, role: 'doctor', branchId });
  return id;
}

async function branchIn(tenantId: string, cityId: string, areaId: string | null, archived = false) {
  const [row] = await su()
    .insert(branch)
    .values({
      tenantId,
      name: 'فرع تجريبي',
      cityId,
      areaId,
      archivedAt: archived ? new Date() : null,
    })
    .returning({ id: branch.id });
  if (!row) throw new Error('branch not written');
  return row.id;
}

describe('place_counts()', () => {
  it('counts branches, clinics and doctors across clinics, integers only', async () => {
    const a1 = await branchIn(A, ALEPPO, SHAHBA);
    const a2 = await branchIn(A, ALEPPO, JAMILIYEH);
    await branchIn(A, ALEPPO, SHAHBA, true); // archived: not counted
    const b1 = await branchIn(B, ALEPPO, SHAHBA);
    await doctor(A, a1);
    await doctor(A, a2);
    await doctor(A, null); // clinic-wide: counted once for every place A holds
    await doctor(A, a1, 'deactivated'); // not counted
    await doctor(B, b1);
    await doctor(B, null, 'pending'); // pending, not deactivated: counted
    const cities = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'city.listed' },
      (tx) => placeCounts(tx, 'city', [ALEPPO, AZAZ]),
    );
    expect(Object.fromEntries(cities)).toEqual({
      [ALEPPO]: { branchCount: 3, clinicCount: 2, doctorCount: 5 },
      [AZAZ]: { branchCount: 0, clinicCount: 0, doctorCount: 0 },
    });
    const areas = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'city.listed' },
      (tx) => placeCounts(tx, 'area', [SHAHBA, JAMILIYEH]),
    );
    expect(Object.fromEntries(areas)).toEqual({
      [SHAHBA]: { branchCount: 2, clinicCount: 2, doctorCount: 4 },
      [JAMILIYEH]: { branchCount: 1, clinicCount: 1, doctorCount: 2 },
    });
  });

  it('answers only in place actions, and restores the caller’s tenant', async () => {
    for (const event of ['clinic.viewed', 'flag.changed', 'entitlement.viewed'] as const) {
      expect(
        await refused(() =>
          testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event }, (tx) =>
            placeCounts(tx, 'city', [ALEPPO]),
          ),
        ),
        event,
      ).toBe('42501');
    }
    const after = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'area.renamed' },
      async (tx) => {
        await placeCounts(tx, 'area', [SHAHBA]);
        const { rows } = await tx.execute<{ t: string }>(
          sql`select coalesce(current_setting('app.tenant_id', true), '') as t`,
        );
        return rows[0]?.t;
      },
    );
    expect(after).toBe('');
  });

  it('is not for shifa_app or shifa_auth', async () => {
    expect(
      await refused(() =>
        rawAppDb().execute(sql`select * from place_counts('city', array[${ALEPPO}]::uuid[],
                                                          array[${A}]::uuid[])`),
      ),
    ).toBe('42501');
  });
});
