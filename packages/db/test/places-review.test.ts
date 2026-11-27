// Security review of A-02-06 (ADR-0051, OD-129): place_counts() trusts the caller's clinic list,
// so placeCounts() must always pass every clinic from `tenant` in the same statement (pinned here
// in its source, and by its answer for a clinic created last); both arrays are capped at 10000.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { placeCounts } from '../src/index.ts';
import { branch, city } from '../src/schema/index.ts';
import {
  createTestTenants,
  fixtureId,
  superuserDb,
  testPlatformDb,
  workerDatabaseName,
} from '../test-harness/index.ts';

const A = fixtureId('places-review tenant A');
const B = fixtureId('places-review tenant B');
const ADMIN = fixtureId('places-review admin');
const ALEPPO = fixtureId('places-review aleppo');
const su = () => superuserDb(workerDatabaseName());
const code = (err: unknown) =>
  (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;

beforeEach(async () => {
  await createTestTenants(A, B);
  await su().insert(city).values({ id: ALEPPO, name: 'حلب', nameKey: 'حلب' });
  await su()
    .insert(branch)
    .values([
      { tenantId: A, name: 'فرع', cityId: ALEPPO },
      { tenantId: B, name: 'فرع', cityId: ALEPPO },
    ]);
});

describe('placeCounts() passes every clinic', () => {
  it('names `array(select id from tenant)` as the clinic list in its one statement', () => {
    const source = readFileSync(join(import.meta.dirname, '..', 'src', 'places.ts'), 'utf8');
    expect(source).toMatch(
      /from place_counts\(\$\{kind\}, \$\{places\}::uuid\[\], array\(select id from tenant\)\)/,
    );
  });

  it('counts every clinic that holds the place', async () => {
    const counts = await testPlatformDb().withPlatformAdmin(
      { actorId: ADMIN, event: 'city.listed' },
      (tx) => placeCounts(tx, 'city', [ALEPPO]),
    );
    expect(counts.get(ALEPPO)).toEqual({ branchCount: 2, clinicCount: 2, doctorCount: 0 });
  });
});

describe('place_counts() caps its arrays', () => {
  const call = (places: number, tenants: number) =>
    testPlatformDb().withPlatformAdmin({ actorId: ADMIN, event: 'city.listed' }, (tx) =>
      tx.execute(sql`select count(*) from place_counts('city',
        array(select gen_random_uuid() from generate_series(1, ${places})),
        array(select gen_random_uuid() from generate_series(1, ${tenants})))`),
    );

  it('refuses more than 10000 places or clinics (54000)', async () => {
    for (const [places, tenants] of [
      [10001, 1],
      [1, 10001],
    ] as const) {
      let refused: string | undefined;
      try {
        await call(places, tenants);
      } catch (err) {
        refused = code(err);
      }
      expect(refused, `${String(places)} places, ${String(tenants)} clinics`).toBe('54000');
    }
  });

  it('answers at the cap', async () => {
    const res = await call(10000, 1);
    expect(res.rows).toEqual([{ count: '10000' }]);
  });
});
