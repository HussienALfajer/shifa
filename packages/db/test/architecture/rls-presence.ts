// Catalog checks behind rls-presence.test.ts (0.2-06b, ADR-0004). Returns one message per
// violation, each starting with the relation name and saying how to fix it.
import { sql } from 'drizzle-orm';
import type { TableClassification } from '../../src/schema/classification.ts';
import type { RawDb } from '../../test-harness/index.ts';

export type Catalog = Pick<RawDb, 'execute'>;

const CLASSIFICATION_FILE = 'packages/db/src/schema/classification.ts';
const TENANT_FILTER = /\btenant_id = current_tenant_id\(\)/;
const COMMANDS = { r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE' } as const;
type Command = keyof typeof COMMANDS;

interface RelationRow {
  name: string;
  kind: string;
  rls: boolean;
  force: boolean;
  has_tenant_id: boolean;
  tenant_id_ok: boolean;
  public_grant: boolean;
  options: string[];
}

interface PolicyRow {
  table: string;
  name: string;
  cmd: Command | '*';
  permissive: boolean;
  qual: string | null;
  check: string | null;
}

interface IndexRow {
  table: string;
  index: string;
  primary: boolean;
  lead: string | null;
}

async function relations(db: Catalog): Promise<RelationRow[]> {
  const { rows } = await db.execute<RelationRow>(sql`
    select c.relname as name, c.relkind::text as kind,
           c.relrowsecurity as rls, c.relforcerowsecurity as force,
           exists (select 1 from pg_attribute a where a.attrelid = c.oid
                     and a.attname = 'tenant_id' and not a.attisdropped) as has_tenant_id,
           exists (select 1 from pg_attribute a where a.attrelid = c.oid
                     and a.attname = 'tenant_id' and not a.attisdropped
                     and a.atttypid = 'uuid'::regtype and a.attnotnull) as tenant_id_ok,
           exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) x
                     where x.grantee = 0) as public_grant,
           coalesce(c.reloptions, '{}'::text[]) as options
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p', 'f', 'v', 'm')
     order by c.relname`);
  return rows;
}

async function policies(db: Catalog): Promise<PolicyRow[]> {
  const { rows } = await db.execute<PolicyRow>(sql`
    select c.relname as table, p.polname as name, p.polcmd::text as cmd,
           p.polpermissive as permissive,
           pg_get_expr(p.polqual, p.polrelid) as qual,
           pg_get_expr(p.polwithcheck, p.polrelid) as check
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
     order by c.relname, p.polname`);
  return rows;
}

async function indexes(db: Catalog): Promise<IndexRow[]> {
  const { rows } = await db.execute<IndexRow>(sql`
    select t.relname as table, i.relname as index, x.indisprimary as primary,
           (select a.attname from pg_attribute a
             where a.attrelid = t.oid and a.attnum = x.indkey[0]) as lead
      from pg_index x
      join pg_class i on i.oid = x.indexrelid
      join pg_class t on t.oid = x.indrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public'
     order by t.relname, i.relname`);
  return rows;
}

/** A permissive policy must filter on tenant_id = current_tenant_id() wherever it applies. */
function policyIsTenantScoped(p: PolicyRow): boolean {
  const usingOk = p.qual !== null && TENANT_FILTER.test(p.qual);
  const checkOk = p.check !== null && TENANT_FILTER.test(p.check);
  switch (p.cmd) {
    case 'r':
    case 'd':
      return usingOk;
    case 'a':
      return checkOk;
    case 'w':
    case '*': // USING, and WITH CHECK when given (it defaults to USING)
      return usingOk && (p.check === null || checkOk);
  }
}

function tenantTableViolations(
  rel: RelationRow,
  tablePolicies: PolicyRow[],
  tableIndexes: IndexRow[],
): string[] {
  const t = rel.name;
  const out: string[] = [];
  if (!rel.tenant_id_ok) out.push(`${t}: tenant table needs a column tenant_id uuid not null`);
  if (!rel.rls) out.push(`${t}: ENABLE ROW LEVEL SECURITY is off`);
  if (!rel.force) out.push(`${t}: FORCE ROW LEVEL SECURITY is off (the owner would bypass RLS)`);
  if (rel.public_grant) out.push(`${t}: privileges granted to PUBLIC; grant to shifa_app only`);
  const permissive = tablePolicies.filter((p) => p.permissive);
  for (const p of permissive) {
    if (!policyIsTenantScoped(p)) {
      out.push(
        `${t}: policy "${p.name}" must filter on tenant_id = current_tenant_id() in USING and WITH CHECK`,
      );
    }
  }
  for (const [cmd, label] of Object.entries(COMMANDS)) {
    if (!permissive.some((p) => p.cmd === cmd || p.cmd === '*')) {
      out.push(`${t}: no policy for ${label} on current_tenant_id() (see /rls-policy)`);
    }
  }
  for (const ix of tableIndexes) {
    if (!ix.primary && ix.lead !== 'tenant_id') {
      out.push(`${t}: index ${ix.index} does not lead with tenant_id (ADR-0004)`);
    }
  }
  return out;
}

function isSecurityInvoker(options: string[]): boolean {
  return options.some((o) => /^security_invoker=(true|on|yes|1)$/i.test(o));
}

/** Every violation of the RLS rules in `public`, given the table classification. */
export async function checkRlsPresence(
  db: Catalog,
  classification: TableClassification,
): Promise<string[]> {
  const [rels, pols, idxs] = [await relations(db), await policies(db), await indexes(db)];
  const out: string[] = [];
  const tableNames = new Set<string>();
  for (const rel of rels) {
    if (rel.kind === 'v') {
      if (!isSecurityInvoker(rel.options)) {
        out.push(`${rel.name}: view must be created WITH (security_invoker = true)`);
      }
      continue;
    }
    if (rel.kind === 'm') {
      out.push(
        `${rel.name}: materialized view runs as its owner and cannot be security_invoker; use a security_invoker view or a tenant table`,
      );
      continue;
    }
    tableNames.add(rel.name);
    const cls = Object.hasOwn(classification, rel.name) ? classification[rel.name] : undefined;
    if (!cls) {
      out.push(
        `${rel.name}: not classified; add it to ${CLASSIFICATION_FILE} as tenant, global or system`,
      );
    } else if (cls.kind === 'tenant') {
      out.push(
        ...tenantTableViolations(
          rel,
          pols.filter((p) => p.table === rel.name),
          idxs.filter((i) => i.table === rel.name),
        ),
      );
    } else if (rel.has_tenant_id) {
      out.push(
        `${rel.name}: classified ${cls.kind} but has a tenant_id column; classify it tenant`,
      );
    }
  }
  for (const name of Object.keys(classification)) {
    if (!tableNames.has(name)) {
      out.push(`${name}: listed in ${CLASSIFICATION_FILE} but the table does not exist`);
    }
  }
  out.push(...(await appRoleViolations(db)));
  return out;
}

/** Repeats the 0.2-05 role guarantees at catalog level: shifa_app owns nothing, bypasses nothing. */
async function appRoleViolations(db: Catalog): Promise<string[]> {
  const { rows } = await db.execute<{ owns: boolean; bypass: boolean }>(sql`
    select exists (select 1 from pg_class where relowner = r.oid)
             or exists (select 1 from pg_namespace where nspowner = r.oid)
             or exists (select 1 from pg_proc where proowner = r.oid) as owns,
           r.rolbypassrls or r.rolsuper as bypass
      from pg_roles r where r.rolname = 'shifa_app'`);
  const row = rows[0];
  if (!row) return ['shifa_app: role does not exist'];
  const out: string[] = [];
  if (row.owns) out.push('shifa_app: owns objects (FORCE RLS does not bind an owner)');
  if (row.bypass) out.push('shifa_app: is superuser or has BYPASSRLS');
  return out;
}
