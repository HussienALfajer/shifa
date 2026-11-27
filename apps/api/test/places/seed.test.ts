// A-02-06: the first list of places (Aleppo with its neighbourhoods, Azaz; drafted by us for the
// owner's review) is stored with each name's key exactly as the API folds it, so a super admin's
// «الجميليه» meets the seeded «الجميلية» (409 `place_name_taken`). Read from a pristine clone of the
// migrated template (other files empty their own database).
import { placeKey } from '@shifa/contracts';
import { ensureWorkerDatabase, superuserDb } from '@shifa/db/testing';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

describe('the seeded places', () => {
  it('hold Aleppo and Azaz, each name with its folded key', async () => {
    const db = superuserDb(await ensureWorkerDatabase('9997'));
    const { rows } = await db.execute<{ kind: string; name: string; key: string }>(sql`
      select 'city' as kind, name, name_key as key from city
      union all
      select 'area', name, name_key from area order by 1, 2`);
    expect(rows.filter((r) => r.kind === 'city').map((r) => r.name)).toEqual(['أعزاز', 'حلب']);
    expect(rows.filter((r) => r.kind === 'area').length).toBeGreaterThanOrEqual(40);
    for (const row of rows) expect(row.key, row.name).toBe(placeKey(row.name));
  });
});
