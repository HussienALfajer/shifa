// Keys are UUIDs; the schema has no sequence (A-01a criterion 1). A sequence is shared state
// across tenants (its next value reveals how many rows others wrote) and would not survive a
// tenant's move to another database (ADR-0004 tenant_deployment).
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { ensureWorkerDatabase, ownerDb } from '../test-harness/index.ts';

// The pristine clone also used by the RLS presence check: no test-only tables in it.
const pristine = () => ensureWorkerDatabase('9997');

describe('schema keys', () => {
  it('has no sequence, identity or serial column in any schema the application uses', async () => {
    const db = ownerDb(await pristine());
    const { rows } = await db.execute<{ what: string }>(sql`
      select format('sequence %I.%I', n.nspname, c.relname) as what
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where c.relkind = 'S' and n.nspname not in ('drizzle', 'pg_catalog', 'information_schema')
      union all
      select format('identity column %I.%I', c.relname, a.attname)
        from pg_attribute a join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and a.attidentity <> '' and not a.attisdropped
      union all
      select format('nextval default on %s', d.adrelid::regclass)
        from pg_attrdef d join pg_class c on c.oid = d.adrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and pg_get_expr(d.adbin, d.adrelid) like 'nextval(%'`);
    expect(rows.map((r) => r.what)).toEqual([]);
  });

  it('every table in public has a primary key made of uuid columns', async () => {
    const db = ownerDb(await pristine());
    const { rows } = await db.execute<{ t: string; ok: boolean }>(sql`
      select c.relname as t,
             coalesce((select bool_and(a.atttypid = 'uuid'::regtype)
                         from pg_index x join pg_attribute a
                           on a.attrelid = x.indrelid and a.attnum = any (x.indkey)
                        where x.indrelid = c.oid and x.indisprimary), false) as ok
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p') order by 1`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((r) => !r.ok).map((r) => r.t)).toEqual([]);
  });

  it('the no-sequence check fails a serial column (red case)', async () => {
    class RolledBack extends Error {}
    let found = 0;
    await expect(
      ownerDb(await pristine()).transaction(async (tx) => {
        await tx.execute(sql`create table keys_probe (id serial primary key)`);
        const { rows } = await tx.execute<{ n: number }>(sql`
          select count(*)::int as n from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where c.relkind = 'S' and n.nspname = 'public'`);
        found = rows[0]?.n ?? 0;
        throw new RolledBack();
      }),
    ).rejects.toThrow(RolledBack);
    expect(found).toBe(1);
  });
});
