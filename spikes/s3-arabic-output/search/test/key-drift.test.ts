// Criterion 10: the SQL function (generated column) and the TypeScript port (stored column)
// must give the same key for every vector input; any difference fails here.
import { ownerDb, testDb } from '@shifa/db/testing';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { normaliseName } from '../src/normalise.ts';
import { applySchema } from './db.ts';
import { loadVectors } from './vectors.ts';

const vectors = loadVectors();

beforeAll(applySchema);

describe('s3.normalise_name() vs normaliseName()', () => {
  it('agrees on every vector input and gives the vector key', async () => {
    const inputs = vectors.cases.map((c) => c.input);
    const { rows } = await ownerDb().execute<{ ord: number; key: string }>(
      sql`select ord::int, s3.normalise_name(input) as key
            from unnest(${sql.param(inputs)}::text[]) with ordinality as t(input, ord) order by ord`,
    );
    const drift = vectors.cases.flatMap((c, index) => {
      const sqlKey = rows[index]?.key;
      const tsKey = normaliseName(c.input);
      return sqlKey === tsKey && sqlKey === c.key ? [] : [{ id: c.id, sqlKey, tsKey, key: c.key }];
    });
    expect(rows).toHaveLength(inputs.length);
    expect(drift).toEqual([]);
  });

  it('keeps display_name untouched while the generated key follows it', async () => {
    const tenantId = '00000000-0000-4000-8000-0000000000aa';
    const userId = '00000000-0000-4000-8000-000000000001';
    const rows = await testDb().withTenant({ tenantId, userId }, async (tx) => {
      await tx.execute(
        sql`insert into s3.patient_b (id, display_name) values (gen_random_uuid(), ${'فاطِمة عبد الله'})`,
      );
      const { rows: read } = await tx.execute<{ display_name: string; name_key: string }>(
        sql`select display_name, name_key from s3.patient_b`,
      );
      return read;
    });
    expect(rows).toEqual([{ display_name: 'فاطِمة عبد الله', name_key: 'فاطمه عبدالله' }]);
  });
});
