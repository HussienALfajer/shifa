// RLS presence check, A-01 additions (A-01b criterion 13, backlog B1 and B7, ADR-0043): only
// policies for PUBLIC or shifa_app count as tenant coverage; a policy for shifa_auth or
// shifa_platform needs a reason in the classification; the access classes 'append-only' and
// 'read-only' are checked against shifa_app's privileges; a nullable tenant_id needs a reason.
// Red cases run inside an owner transaction on the pristine clone that is always rolled back.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { TABLE_CLASSIFICATION, type TableClassification } from '../../src/schema/classification.ts';
import { ensureWorkerDatabase, ownerDb } from '../../test-harness/index.ts';
import { type Catalog, checkRlsPresence } from './rls-presence.ts';

let pristine: string;

beforeAll(async () => {
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

const OK = 'tenant_id = current_tenant_id()';
const probe = (extra = '', tenantColumn = 'tenant_id uuid not null') => `
  create table roles_probe (id uuid primary key, ${tenantColumn}, label text);
  alter table roles_probe enable row level security;
  alter table roles_probe force row level security;
  create policy tenant_isolation on roles_probe using (${OK}) with check (${OK});
  ${extra}`;

const withProbe = (cls: TableClassification[string]): TableClassification => ({
  ...TABLE_CLASSIFICATION,
  roles_probe: cls,
});

describe('RLS presence: policies of other roles', () => {
  it('fails a shifa_auth policy without a reason, naming the policy', async () => {
    const found = await violationsWith(
      probe('create policy auth_read on roles_probe for select to shifa_auth using (true);'),
      withProbe({ kind: 'tenant' }),
    );
    expect(found).toEqual([expect.stringMatching(/roles_probe.*"auth_read".*shifa_auth.*reason/)]);
  });

  it('passes a shifa_platform policy whose reason is in the classification', async () => {
    const found = await violationsWith(
      probe(
        'create policy platform_read on roles_probe for select to shifa_platform using (true);',
      ),
      withProbe({ kind: 'tenant', roleAccess: { platform_read: 'routing reads every tenant' } }),
    );
    expect(found).toEqual([]);
  });

  it('fails a reason whose policy does not exist', async () => {
    const found = await violationsWith(
      probe(),
      withProbe({ kind: 'tenant', roleAccess: { gone: 'stale entry' } }),
    );
    expect(found).toEqual([expect.stringMatching(/roles_probe.*"gone".*does not exist/)]);
  });

  it('fails a policy for a role that is not an application role', async () => {
    const found = await violationsWith(
      probe('create policy owner_all on roles_probe to shifa_owner using (true);'),
      withProbe({ kind: 'tenant', roleAccess: { owner_all: 'no' } }),
    );
    expect(found).toEqual([expect.stringMatching(/roles_probe.*"owner_all".*shifa_owner/)]);
  });

  it('does not count a shifa_platform policy as tenant coverage', async () => {
    const found = await violationsWith(
      `create table roles_probe (id uuid primary key, tenant_id uuid not null);
       alter table roles_probe enable row level security;
       alter table roles_probe force row level security;
       create policy r on roles_probe for select using (${OK});
       create policy i on roles_probe for insert with check (${OK});
       create policy u on roles_probe for update using (${OK}) with check (${OK});
       create policy d on roles_probe for delete to shifa_platform using (${OK});`,
      withProbe({ kind: 'tenant', roleAccess: { d: 'platform deletes' } }),
    );
    expect(found).toEqual([expect.stringMatching(/roles_probe.*no policy for DELETE/)]);
  });

  it('fails a policy for shifa_auth on a global table without a reason', async () => {
    const found = await violationsWith(
      `create table roles_probe (id uuid primary key);
       alter table roles_probe enable row level security;
       create policy auth_all on roles_probe to shifa_auth using (true) with check (true);`,
      withProbe({ kind: 'global', reason: 'probe' }),
    );
    expect(found).toEqual([expect.stringMatching(/roles_probe.*"auth_all".*reason/)]);
  });
});

describe('RLS presence: access classes', () => {
  const appendOnly = `create table roles_probe (id uuid primary key, tenant_id uuid not null);
    alter table roles_probe enable row level security;
    alter table roles_probe force row level security;
    create policy r on roles_probe for select using (${OK});
    create policy i on roles_probe for insert with check (${OK});`;

  it('passes an append-only table without UPDATE or DELETE policies or privileges', async () => {
    const found = await violationsWith(
      `${appendOnly} revoke update, delete on roles_probe from shifa_app;`,
      withProbe({ kind: 'tenant', access: 'append-only' }),
    );
    expect(found).toEqual([]);
  });

  it('fails an append-only table that an application role may update or delete', async () => {
    const found = await violationsWith(
      `${appendOnly} revoke delete on roles_probe from shifa_app;
       grant delete on roles_probe to shifa_platform;`,
      withProbe({ kind: 'tenant', access: 'append-only' }),
    );
    expect(found.join('\n')).toMatch(/roles_probe.*append-only.*shifa_app.*UPDATE/);
    expect(found.join('\n')).toMatch(/roles_probe.*append-only.*shifa_platform.*DELETE/);
  });

  it('fails a read-only table that shifa_app may write', async () => {
    const found = await violationsWith(
      `${probe()} revoke insert, delete on roles_probe from shifa_app;`,
      withProbe({ kind: 'tenant', access: 'read-only' }),
    );
    expect(found).toEqual([expect.stringMatching(/roles_probe.*read-only.*shifa_app.*UPDATE/)]);
  });

  it('fails a nullable tenant_id without a platformRows reason', async () => {
    const found = await violationsWith(probe('', 'tenant_id uuid'), withProbe({ kind: 'tenant' }));
    expect(found).toEqual([expect.stringMatching(/roles_probe.*tenant_id uuid not null/)]);
  });

  it('passes a nullable tenant_id with a platformRows reason', async () => {
    const found = await violationsWith(
      probe('', 'tenant_id uuid'),
      withProbe({ kind: 'tenant', platformRows: 'platform events have no tenant' }),
    );
    expect(found).toEqual([]);
  });
});
