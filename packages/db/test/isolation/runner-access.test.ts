// Runner features added for A-01 (A-01-01): prepare() writes parent rows before the seed (A-01b
// criterion 1), and the access classes 'append-only' (backlog B7) and 'read-only' expect
// shifa_app's writes to be refused by privileges ("permission denied") rather than filtered by a
// policy. Probe tables exist only in test databases. Directly and through PgBouncer.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { TableClassification } from '../../src/schema/classification.ts';
import { ownerDb } from '../../test-harness/index.ts';
import { defineIsolationCase } from './define.ts';
import { DB_MODES } from './modes.ts';
import { runIsolationCase } from './runner.ts';

const OK = 'tenant_id = current_tenant_id()';

beforeAll(async () => {
  const table = (name: string, columns: string, grants = '') => `
    create table if not exists ${name} (${columns});
    alter table ${name} enable row level security;
    alter table ${name} force row level security;
    drop policy if exists p on ${name};
    create policy p on ${name} using (${OK}) with check (${OK});
    ${grants}`;
  await ownerDb().execute(
    sql.raw(`
    ${table('access_parent', 'tenant_id uuid not null, id uuid not null, primary key (tenant_id, id)')}
    ${table(
      'access_child',
      `tenant_id uuid not null, parent_id uuid not null, label text not null,
       foreign key (tenant_id, parent_id) references access_parent (tenant_id, id)`,
    )}
    ${table(
      'access_append',
      'tenant_id uuid not null, label text not null',
      'revoke update, delete on access_append from shifa_app;',
    )}
    ${table('access_append_leaky', 'tenant_id uuid not null, label text not null')}
    ${table(
      'access_read',
      'tenant_id uuid not null, label text not null',
      'revoke insert, update, delete on access_read from shifa_app;',
    )}
    ${table('access_read_leaky', 'tenant_id uuid not null, label text not null')}
  `),
  );
});

const parentOf = (tenantId: string) => `${tenantId.slice(0, 24)}00000000000f`;

const childCase = defineIsolationCase({
  table: 'access_child',
  prepare: async (ctx) => {
    for (const tenantId of ctx.tenants) {
      await ctx.inTenant(tenantId, (tx) =>
        tx.execute(
          sql`insert into access_parent (tenant_id, id) values (${tenantId}, ${parentOf(tenantId)})`,
        ),
      );
    }
  },
  seed: async (tx, tenantId) => {
    await tx.execute(
      sql`insert into access_child (tenant_id, parent_id, label)
          values (${tenantId}, ${parentOf(tenantId)}, 'child')`,
    );
  },
  paths: {
    all: async (tx) => (await tx.execute(sql`select tenant_id from access_child`)).rows,
  },
});

const labelled = (table: string) => {
  const t = sql.identifier(table);
  return defineIsolationCase({
    table,
    seed: async (tx, tenantId) => {
      await tx.execute(sql`insert into ${t} (tenant_id, label) values (${tenantId}, 'one')`);
    },
    paths: { all: async (tx) => (await tx.execute(sql`select tenant_id from ${t}`)).rows },
  });
};

const classification: TableClassification = {
  access_parent: { kind: 'tenant' },
  access_child: { kind: 'tenant' },
  access_append: { kind: 'tenant', access: 'append-only' },
  access_append_leaky: { kind: 'tenant', access: 'append-only' },
  access_read: { kind: 'tenant', access: 'read-only' },
  access_read_leaky: { kind: 'tenant', access: 'read-only' },
};

describe.each(DB_MODES)('isolation runner access classes (%s)', (_mode, db) => {
  it('prepare() writes parent rows so the seed reaches only its own table', async () => {
    expect(await runIsolationCase(db(), childCase, classification)).toEqual([]);
  });

  it('reports a missing parent when prepare() is left out', async () => {
    const withoutPrepare = { ...childCase, prepare: undefined };
    await expect(
      runIsolationCase(db(), defineIsolationCase(withoutPrepare), classification),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('passes an append-only table whose UPDATE and DELETE are refused by privileges', async () => {
    expect(await runIsolationCase(db(), labelled('access_append'), classification)).toEqual([]);
  });

  it('reports an append-only table that shifa_app can update or delete', async () => {
    const text = (
      await runIsolationCase(db(), labelled('access_append_leaky'), classification)
    ).join('\n');
    expect(text).toMatch(
      /access_append_leaky: update without WHERE .* was not refused by privileges/,
    );
    expect(text).toMatch(
      /access_append_leaky: delete without WHERE .* was not refused by privileges/,
    );
  });

  it('passes a read-only table (seeded by the owner in each tenant context)', async () => {
    expect(await runIsolationCase(db(), labelled('access_read'), classification)).toEqual([]);
  });

  it('reports a read-only table that shifa_app can write', async () => {
    const text = (await runIsolationCase(db(), labelled('access_read_leaky'), classification)).join(
      '\n',
    );
    expect(text).toMatch(/access_read_leaky: insert .* was not refused by privileges/);
    expect(text).toMatch(
      /access_read_leaky: delete without WHERE .* was not refused by privileges/,
    );
  });
});
