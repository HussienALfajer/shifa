// The spike tables follow the tenancy rules of `public`: FORCE RLS, policies on
// current_tenant_id(), a GIN trigram index led by tenant_id.
import { ownerDb } from '@shifa/db/testing';
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { SEARCH_TABLES } from '../src/search.ts';
import { applySchema } from './db.ts';

beforeAll(applySchema);

describe('s3 schema', () => {
  it('forces RLS with a current_tenant_id() policy on every s3 table', async () => {
    const { rows } = await ownerDb().execute<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      policies: string[] | null;
    }>(sql`select c.relname, c.relrowsecurity, c.relforcerowsecurity,
                  (select array_agg(pg_get_expr(p.polqual, p.polrelid) || ' / ' ||
                                    pg_get_expr(p.polwithcheck, p.polrelid))
                     from pg_policy p where p.polrelid = c.oid) as policies
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 's3' and c.relkind = 'r' order by c.relname`);
    expect(rows.map((r) => r.relname)).toEqual([...SEARCH_TABLES].sort());
    for (const row of rows) {
      expect(row.relrowsecurity, row.relname).toBe(true);
      expect(row.relforcerowsecurity, row.relname).toBe(true);
      expect(row.policies, row.relname).toHaveLength(1);
      expect(row.policies?.[0], row.relname).toMatch(
        /^\(tenant_id = current_tenant_id\(\)\) \/ \(tenant_id = current_tenant_id\(\)\)$/,
      );
    }
  });

  it('has a GIN trigram index on (tenant_id, name_key) for each table', async () => {
    const { rows } = await ownerDb().execute<{ tablename: string; indexdef: string }>(
      sql`select tablename, indexdef from pg_indexes where schemaname = 's3' and indexdef like '%gin%'`,
    );
    for (const table of SEARCH_TABLES) {
      const def = rows.find((r) => r.tablename === table)?.indexdef ?? '';
      expect(def, table).toMatch(/USING gin \(tenant_id, name_key gin_trgm_ops\)/);
    }
  });

  it('computes patient_b.name_key in a generated column from an IMMUTABLE function', async () => {
    const { rows } = await ownerDb().execute<{
      volatile: string;
      parallel: string;
      generated: string;
    }>(
      sql`select p.provolatile as volatile, p.proparallel as parallel,
                 (select a.attgenerated from pg_attribute a
                   where a.attrelid = 's3.patient_b'::regclass and a.attname = 'name_key') as generated
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 's3' and p.proname = 'normalise_name'`,
    );
    expect(rows).toEqual([{ volatile: 'i', parallel: 's', generated: 's' }]);
  });
});
