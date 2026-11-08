// RLS presence check (0.2-06b, ADR-0004): every table in `public` is classified, and every
// tenant table carries tenant_id, ENABLE + FORCE RLS and policies on current_tenant_id().
// Runs on a pristine clone of the migrated template (other test files add probe tables to the
// worker database). Red cases create tables inside an owner transaction that is rolled back.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { TABLE_CLASSIFICATION, type TableClassification } from '../../src/schema/classification.ts';
import { ensureWorkerDatabase, ownerDb } from '../../test-harness/index.ts';
import { type Catalog, checkRlsPresence } from './rls-presence.ts';

let pristine: string;

beforeAll(async () => {
  // Numeric pool ids only; 9997 is reserved for this file (hardening.test.ts uses 9998).
  pristine = await ensureWorkerDatabase('9997');
});

class RolledBack extends Error {}

/** Runs `setup` then the check as the owner, inside a transaction that is always rolled back. */
async function violationsWith(
  setup: ReturnType<typeof sql>,
  classification: TableClassification,
): Promise<string[]> {
  let found: string[] = [];
  try {
    await ownerDb(pristine).transaction(async (tx) => {
      await tx.execute(setup);
      found = await checkRlsPresence(tx as unknown as Catalog, classification);
      throw new RolledBack();
    });
  } catch (err) {
    if (!(err instanceof RolledBack)) throw err;
  }
  return found;
}

const probe = (extra = '') =>
  sql.raw(`
  create table presence_probe (id uuid primary key, tenant_id uuid not null, label text);
  create index presence_probe_label on presence_probe (tenant_id, label);
  alter table presence_probe enable row level security;
  alter table presence_probe force row level security;
  create policy tenant_isolation on presence_probe
    using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
  ${extra}
`);

const asTenant: TableClassification = {
  ...TABLE_CLASSIFICATION,
  presence_probe: { kind: 'tenant' },
};

describe('RLS presence check', () => {
  it('passes on the migrated schema', async () => {
    expect(await checkRlsPresence(ownerDb(pristine), TABLE_CLASSIFICATION)).toEqual([]);
  });

  it('passes a correct tenant table', async () => {
    expect(await violationsWith(probe(), asTenant)).toEqual([]);
  });

  it('fails an unclassified table, naming it and the fix', async () => {
    const found = await violationsWith(probe(), TABLE_CLASSIFICATION);
    expect(found).toEqual([expect.stringMatching(/presence_probe.*classification\.ts/)]);
  });

  it('fails a tenant table without FORCE ROW LEVEL SECURITY', async () => {
    const found = await violationsWith(
      probe('alter table presence_probe no force row level security;'),
      asTenant,
    );
    expect(found).toEqual([expect.stringMatching(/presence_probe.*FORCE/)]);
  });

  it('fails a tenant table without ENABLE ROW LEVEL SECURITY', async () => {
    const found = await violationsWith(
      probe('alter table presence_probe disable row level security;'),
      asTenant,
    );
    expect(found).toEqual([expect.stringMatching(/presence_probe.*ENABLE/)]);
  });

  it('fails a tenant table without a policy', async () => {
    const found = await violationsWith(
      probe('drop policy tenant_isolation on presence_probe;'),
      asTenant,
    );
    expect(found.join('\n')).toMatch(/presence_probe.*no policy for SELECT/);
    expect(found.join('\n')).toMatch(/presence_probe.*no policy for INSERT/);
  });

  it('fails a policy that does not use current_tenant_id()', async () => {
    const found = await violationsWith(
      probe('create policy leak on presence_probe for select using (true);'),
      asTenant,
    );
    expect(found).toEqual([
      expect.stringMatching(/presence_probe.*policy "leak".*current_tenant_id/),
    ]);
  });

  it('fails a per-command policy set that misses one command', async () => {
    const found = await violationsWith(
      probe(`drop policy tenant_isolation on presence_probe;
        create policy r on presence_probe for select using (tenant_id = current_tenant_id());
        create policy i on presence_probe for insert with check (tenant_id = current_tenant_id());
        create policy u on presence_probe for update using (tenant_id = current_tenant_id())
          with check (tenant_id = current_tenant_id());`),
      asTenant,
    );
    expect(found).toEqual([expect.stringMatching(/presence_probe.*no policy for DELETE/)]);
  });

  it('fails an index not led by tenant_id', async () => {
    const found = await violationsWith(
      probe('create index presence_probe_bad on presence_probe (label, tenant_id);'),
      asTenant,
    );
    expect(found).toEqual([expect.stringMatching(/presence_probe.*presence_probe_bad.*tenant_id/)]);
  });

  it('fails a tenant table without tenant_id uuid not null', async () => {
    const found = await violationsWith(
      sql.raw(`create table presence_probe (id uuid primary key, label text);
        alter table presence_probe enable row level security;
        alter table presence_probe force row level security;`),
      asTenant,
    );
    expect(found.join('\n')).toMatch(/presence_probe.*tenant_id uuid not null/);
  });

  it('fails a tenant table granted to PUBLIC', async () => {
    const found = await violationsWith(
      probe('grant select on presence_probe to public;'),
      asTenant,
    );
    expect(found).toEqual([expect.stringMatching(/presence_probe.*PUBLIC/)]);
  });

  it('fails a global table that has tenant_id (misclassified)', async () => {
    const found = await violationsWith(probe(), {
      ...TABLE_CLASSIFICATION,
      presence_probe: { kind: 'global', reason: 'test' },
    });
    expect(found).toEqual([expect.stringMatching(/presence_probe.*global.*tenant_id/)]);
  });

  it('fails a classification entry whose table does not exist', async () => {
    const found = await violationsWith(sql`select 1`, asTenant);
    expect(found).toEqual([expect.stringMatching(/presence_probe.*does not exist/)]);
  });

  it('fails a view that is not security_invoker', async () => {
    const found = await violationsWith(
      probe('create view presence_view as select label from presence_probe;'),
      asTenant,
    );
    expect(found).toEqual([expect.stringMatching(/presence_view.*security_invoker/)]);
  });

  it('passes a security_invoker view', async () => {
    const found = await violationsWith(
      probe(`create view presence_view with (security_invoker = true)
        as select label from presence_probe;`),
      asTenant,
    );
    expect(found).toEqual([]);
  });

  it('fails a materialized view (it cannot be security_invoker)', async () => {
    const found = await violationsWith(
      probe('create materialized view presence_mat as select label from presence_probe;'),
      asTenant,
    );
    expect(found).toEqual([expect.stringMatching(/presence_mat.*materialized/)]);
  });

  it('confirms shifa_app owns nothing and does not bypass RLS', async () => {
    const { rows } = await ownerDb(pristine).execute<{ owns: boolean; bypass: boolean }>(sql`
      select exists (select 1 from pg_class where relowner = 'shifa_app'::regrole) as owns,
             (select rolbypassrls or rolsuper from pg_roles where rolname = 'shifa_app') as bypass`);
    expect(rows[0]).toEqual({ owns: false, bypass: false });
  });
});
