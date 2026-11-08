// Red cases added after the 0.2-06b reviews (security review M2 to M4, review N1, N2, N4): each
// is a leaky table, or a weak case, that the first version of the runner reported as isolated.
import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { ownerDb, testDb } from '../../test-harness/index.ts';
import { defineIsolationCase } from './define.ts';
import { runIsolationCase, TENANT_A } from './runner.ts';

const OK = 'tenant_id = current_tenant_id()';

beforeAll(async () => {
  const table = (name: string, policies: string) => `
    create table if not exists ${name} (tenant_id uuid not null, label text not null);
    alter table ${name} enable row level security;
    alter table ${name} force row level security;
    ${policies}`;
  await ownerDb().execute(
    sql.raw(`
    ${table(
      'gap_admin_all',
      `drop policy if exists p on gap_admin_all;
      create policy p on gap_admin_all using (${OK} or current_tenant_id() is null);`,
    )}
    ${table(
      'gap_update_leak',
      `drop policy if exists r on gap_update_leak;
      drop policy if exists i on gap_update_leak;
      drop policy if exists u on gap_update_leak;
      drop policy if exists d on gap_update_leak;
      create policy r on gap_update_leak for select using (${OK});
      create policy i on gap_update_leak for insert with check (${OK});
      create policy u on gap_update_leak for update using (true) with check (true);
      create policy d on gap_update_leak for delete using (${OK});`,
    )}
    ${table(
      'gap_parent',
      `drop policy if exists p on gap_parent;
      create policy p on gap_parent using (${OK}) with check (${OK});`,
    )}
    ${table(
      'gap_child',
      `drop policy if exists p on gap_child;
      create policy p on gap_child using (${OK}) with check (${OK} or true);`,
    )}
    ${table(
      'gap_leaky',
      `drop policy if exists p on gap_leaky;
      create policy p on gap_leaky using (true);`,
    )}
  `),
  );
});

function simpleCase(table: string, paths?: Parameters<typeof defineIsolationCase>[0]['paths']) {
  const t = sql.identifier(table);
  return defineIsolationCase({
    table,
    seed: async (tx, tenantId) => {
      await tx.execute(sql`insert into ${t} (tenant_id, label) values (${tenantId}, 'one')`);
    },
    paths: paths ?? {
      'all rows': async (tx) => (await tx.execute(sql`select tenant_id from ${t}`)).rows,
    },
  });
}

describe('isolation runner gaps', () => {
  it('reports a policy that shows every tenant without a tenant context (M2)', async () => {
    const text = (await runIsolationCase(testDb(), simpleCase('gap_admin_all'))).join('\n');
    expect(text).toMatch(/gap_admin_all: without a tenant context, read path "all rows" returned/);
    expect(text).toMatch(
      /gap_admin_all: insert with tenant B's tenant_id without a tenant context was accepted/,
    );
  });

  it('reports an UPDATE policy that reaches tenant B (N1)', async () => {
    const text = (await runIsolationCase(testDb(), simpleCase('gap_update_leak'))).join('\n');
    expect(text).toMatch(
      /gap_update_leak: update without WHERE inside tenant A changed tenant B's rows/,
    );
  });

  it('does not accept an RLS refusal raised by another table (M4)', async () => {
    const findings = await runIsolationCase(
      testDb(),
      defineIsolationCase({
        table: 'gap_child',
        seed: async (tx, tenantId) => {
          await tx.execute(
            sql`insert into gap_parent (tenant_id, label) values (${tenantId}, 'p')`,
          );
          await tx.execute(sql`insert into gap_child (tenant_id, label) values (${tenantId}, 'c')`);
        },
        paths: {
          'all rows': async (tx) => (await tx.execute(sql`select tenant_id from gap_child`)).rows,
        },
      }),
    );
    expect(findings.join('\n')).toMatch(
      /gap_child: insert with tenant B's tenant_id inside tenant A .*gap_parent/,
    );
  });

  it('checks an unfiltered select even when every path filters by tenant (M3)', async () => {
    const findings = await runIsolationCase(
      testDb(),
      simpleCase('gap_leaky', {
        'own rows': async (tx) =>
          (await tx.execute(sql`select tenant_id from gap_leaky where tenant_id = ${TENANT_A}`))
            .rows,
      }),
    );
    expect(findings.join('\n')).toMatch(
      /gap_leaky: read path "unfiltered select" returned \d+ row\(s\) of tenant B/,
    );
  });

  it('reports a path that returns no rows of its own tenant (N2)', async () => {
    const findings = await runIsolationCase(
      testDb(),
      simpleCase('gap_parent', {
        'nothing matches': async (tx) =>
          (await tx.execute(sql`select tenant_id from gap_parent where label = 'absent'`)).rows,
      }),
    );
    expect(findings).toEqual([
      expect.stringMatching(/gap_parent: read path "nothing matches" returned no rows/),
    ]);
  });
});
