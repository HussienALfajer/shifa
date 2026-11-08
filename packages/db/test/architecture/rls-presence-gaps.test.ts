// Red cases added after the 0.2-06b reviews (security review M1, M5 to M7): each was a broken
// tenant table that passed the first version of the presence check.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { TABLE_CLASSIFICATION, type TableClassification } from '../../src/schema/classification.ts';
import { ensureWorkerDatabase, ownerDb } from '../../test-harness/index.ts';
import { type Catalog, checkRlsPresence } from './rls-presence.ts';

let pristine: string;

beforeAll(async () => {
  // Same pristine clone as rls-presence.test.ts; every case below is rolled back.
  pristine = await ensureWorkerDatabase('9997');
});

class RolledBack extends Error {}

async function violationsWith(setup: string, classification: TableClassification) {
  let found: string[] = [];
  try {
    await ownerDb(pristine).transaction(async (tx) => {
      await tx.execute(sql.raw(setup));
      found = await checkRlsPresence(tx as unknown as Catalog, classification);
      throw new RolledBack();
    });
  } catch (err) {
    if (!(err instanceof RolledBack)) throw err;
  }
  return found;
}

const tenantTable = (name: string, columns: string, using: string, check = using) => `
  create table ${name} (${columns});
  alter table ${name} enable row level security;
  alter table ${name} force row level security;
  create policy p on ${name} using (${using}) with check (${check});`;

const OK = 'tenant_id = current_tenant_id()';
const COLS = 'id uuid primary key, tenant_id uuid not null, label text';
const tenants = (...names: string[]): TableClassification => ({
  ...TABLE_CLASSIFICATION,
  ...Object.fromEntries(names.map((n) => [n, { kind: 'tenant' as const }])),
});

describe('policy expressions (M1)', () => {
  it.each([
    ['OR another condition', `${OK} or label = 'shared'`, OK],
    ['OR no tenant context', `${OK} or current_tenant_id() is null`, OK],
    ['COALESCE', `coalesce(${OK}, true)`, OK],
    ['NOT', `not (${OK})`, OK],
    [
      'a subquery on another alias',
      'exists (select 1 from gap o where o.tenant_id = current_tenant_id())',
      OK,
    ],
    ['WITH CHECK ORed with true', OK, `${OK} or true`],
  ])('fails a policy with %s', async (_label, using, check) => {
    const found = await violationsWith(tenantTable('gap', COLS, using, check), tenants('gap'));
    expect(found).toEqual([expect.stringMatching(/gap: policy "p" must filter/)]);
  });

  it('passes a tenant filter ANDed with another condition', async () => {
    const found = await violationsWith(
      tenantTable('gap', COLS, `${OK} and label is not null`),
      tenants('gap'),
    );
    expect(found).toEqual([]);
  });
});

describe('keys (M5, M6)', () => {
  it('fails a foreign key to a tenant table not led by tenant_id', async () => {
    const found = await violationsWith(
      `${tenantTable('gap_parent', COLS, OK)}
       ${tenantTable('gap_child', `${COLS}, parent_id uuid references gap_parent (id)`, OK)}`,
      tenants('gap_parent', 'gap_child'),
    );
    expect(found).toEqual([expect.stringMatching(/gap_child: foreign key .* tenant_id/)]);
  });

  it('passes a composite foreign key led by tenant_id', async () => {
    const found = await violationsWith(
      `${tenantTable('gap_parent', COLS, OK)}
       create unique index gap_parent_tenant_id on gap_parent (tenant_id, id);
       ${tenantTable('gap_child', `${COLS}, parent_id uuid, foreign key (tenant_id, parent_id) references gap_parent (tenant_id, id)`, OK)}`,
      tenants('gap_parent', 'gap_child'),
    );
    expect(found).toEqual([]);
  });

  it('passes a foreign key to a global table', async () => {
    const found = await violationsWith(
      `create table gap_lookup (code text primary key);
       ${tenantTable('gap_child', `${COLS}, code text references gap_lookup (code)`, OK)}`,
      { ...tenants('gap_child'), gap_lookup: { kind: 'global', reason: 'test' } },
    );
    expect(found).toEqual([]);
  });

  it('fails a natural primary key not led by tenant_id', async () => {
    const found = await violationsWith(
      tenantTable('gap', 'phone text primary key, tenant_id uuid not null', OK),
      tenants('gap'),
    );
    expect(found).toEqual([expect.stringMatching(/gap: index gap_pkey .*tenant_id/)]);
  });
});

describe('schemas (M7)', () => {
  it('fails a table outside public and drizzle', async () => {
    const found = await violationsWith(
      'create schema gap_clinical; create table gap_clinical.notes (tenant_id uuid not null);',
      TABLE_CLASSIFICATION,
    );
    expect(found).toEqual([expect.stringMatching(/gap_clinical\.notes: .*schema/)]);
  });
});
