// Proves the cross-tenant isolation runner (0.2-06b): a correctly isolated probe passes every
// assertion, a leaky probe (policy `using (true)`) is reported by path name, and a tenant
// table without a registered case fails coverage. Probe tables exist only in test databases.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ownerDb } from '../../test-harness/index.ts';
import { defineIsolationCase } from './define.ts';
import { DB_MODES } from './modes.ts';
import { coverageGaps, runIsolationCase } from './runner.ts';

beforeAll(async () => {
  await ownerDb().execute(sql`
    create table if not exists rls_probe_isolation (tenant_id uuid not null, label text not null);
    alter table rls_probe_isolation enable row level security;
    alter table rls_probe_isolation force row level security;
    drop policy if exists tenant_isolation on rls_probe_isolation;
    create policy tenant_isolation on rls_probe_isolation
      using (tenant_id = current_tenant_id())
      with check (tenant_id = current_tenant_id());
    create table if not exists rls_probe_leaky (tenant_id uuid not null, label text not null);
    alter table rls_probe_leaky enable row level security;
    alter table rls_probe_leaky force row level security;
    drop policy if exists leak on rls_probe_leaky;
    create policy leak on rls_probe_leaky using (true);
  `);
});

function probeCase(table: 'rls_probe_isolation' | 'rls_probe_leaky') {
  const t = sql.identifier(table);
  return defineIsolationCase({
    table,
    seed: async (tx, tenantId) => {
      await tx.execute(
        sql`insert into ${t} (tenant_id, label) values (${tenantId}, 'one'), (${tenantId}, 'two')`,
      );
    },
    paths: {
      'all rows': async (tx) => (await tx.execute(sql`select tenant_id, label from ${t}`)).rows,
      'by label': async (tx) =>
        (await tx.execute(sql`select tenant_id from ${t} where label = 'one'`)).rows,
    },
  });
}

// Directly and through PgBouncer (0.3-S2a).
describe.each(DB_MODES)('isolation runner (%s)', (_mode, db) => {
  it('passes a correctly isolated table', async () => {
    expect(await runIsolationCase(db(), probeCase('rls_probe_isolation'))).toEqual([]);
  });

  it('reports every leak of a `using (true)` table, naming the read path', async () => {
    const findings = await runIsolationCase(db(), probeCase('rls_probe_leaky'));
    const text = findings.join('\n');
    expect(text).toMatch(/rls_probe_leaky: read path "all rows" returned \d+ row\(s\) of tenant B/);
    expect(text).toMatch(/rls_probe_leaky: read path "by label" returned \d+ row\(s\) of tenant B/);
    expect(text).toMatch(
      /rls_probe_leaky: insert with tenant B's tenant_id inside tenant A was accepted/,
    );
    expect(text).toMatch(
      /rls_probe_leaky: update moving rows to tenant B inside tenant A was accepted/,
    );
    expect(text).toMatch(
      /rls_probe_leaky: delete without WHERE inside tenant A removed tenant B's rows/,
    );
  });

  it('reports a path that does not select tenant_id (nothing to check)', async () => {
    const base = probeCase('rls_probe_isolation');
    const findings = await runIsolationCase(
      db(),
      defineIsolationCase({
        ...base,
        paths: {
          'labels only': async (tx) =>
            (await tx.execute(sql`select label from rls_probe_isolation`)).rows,
        },
      }),
    );
    expect(findings).toEqual([expect.stringMatching(/"labels only".*tenant_id/)]);
  });

  it('fails coverage for a tenant table without a case, naming the table', () => {
    expect(
      coverageGaps(
        { appointments: { kind: 'tenant' }, settings: { kind: 'global', reason: 'x' } },
        [],
      ),
    ).toEqual([expect.stringMatching(/appointments.*no isolation case/)]);
  });

  it('fails coverage for a case whose table is not classified as tenant', () => {
    expect(coverageGaps({}, [probeCase('rls_probe_isolation')])).toEqual([
      expect.stringMatching(/rls_probe_isolation.*not classified as tenant/),
    ]);
  });
});
