// Catalog checks behind rls-presence.test.ts (0.2-06b, ADR-0004). Returns one message per
// violation, each starting with the relation name and saying how to fix it.
import { sql } from 'drizzle-orm';
import type { TableClassification } from '../../src/schema/classification.ts';
import type { RawDb } from '../../test-harness/index.ts';

export type Catalog = Pick<RawDb, 'execute'>;

const CLASSIFICATION_FILE = 'packages/db/src/schema/classification.ts';
const TENANT_TERM = '(tenant_id = current_tenant_id())';

/** Index of the parenthesis closing the one at `open`, or -1. */
function closingParen(expr: string, open: number): number {
  let depth = 0;
  let quoted = false;
  for (let i = open; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "'") quoted = !quoted;
    if (quoted) continue;
    if (ch === '(') depth++;
    if (ch === ')' && --depth === 0) return i;
  }
  return -1;
}

/**
 * True when the expression (as pg_get_expr prints it) is exactly the tenant filter, or a
 * top-level AND whose first term is the tenant filter. Anything ORed with it is refused.
 */
function isTenantFilter(expr: string | null): boolean {
  if (expr === null) return false;
  if (expr === TENANT_TERM) return true;
  return expr.startsWith(`(${TENANT_TERM} AND `) && closingParen(expr, 0) === expr.length - 1;
}
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
  /** Number of key columns, and whether the single key column is a uuid. */
  keys: number;
  lead_uuid: boolean;
  lead: string | null;
}

interface ForeignKeyRow {
  table: string;
  name: string;
  ref_table: string;
  lead: string | null;
  ref_lead: string | null;
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
           x.indnkeyatts::int as keys,
           coalesce((select a.atttypid = 'uuid'::regtype from pg_attribute a
                      where a.attrelid = t.oid and a.attnum = x.indkey[0]), false) as lead_uuid,
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

async function foreignKeys(db: Catalog): Promise<ForeignKeyRow[]> {
  const { rows } = await db.execute<ForeignKeyRow>(sql`
    select t.relname as table, k.conname as name, r.relname as ref_table,
           (select a.attname from pg_attribute a
             where a.attrelid = k.conrelid and a.attnum = k.conkey[1]) as lead,
           (select a.attname from pg_attribute a
             where a.attrelid = k.confrelid and a.attnum = k.confkey[1]) as ref_lead
      from pg_constraint k
      join pg_class t on t.oid = k.conrelid
      join pg_class r on r.oid = k.confrelid
      join pg_namespace n on n.oid = t.relnamespace
     where k.contype = 'f' and n.nspname = 'public'
     order by t.relname, k.conname`);
  return rows;
}

/** Tables, views and the like outside `public` and Drizzle's migration history. */
async function relationsOutsidePublic(db: Catalog): Promise<string[]> {
  const { rows } = await db.execute<{ name: string; schema: string }>(sql`
    select n.nspname as schema, c.relname as name
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p', 'f', 'v', 'm')
       and n.nspname not in ('public', 'drizzle', 'information_schema')
       and not starts_with(n.nspname, 'pg_')
     order by 1, 2`);
  return rows.map(
    (r) =>
      `${r.schema}.${r.name}: relation in schema ${r.schema}; RLS is only checked in public, so keep tables there`,
  );
}

/** A permissive policy must filter on tenant_id = current_tenant_id() wherever it applies. */
function policyIsTenantScoped(p: PolicyRow): boolean {
  const usingOk = isTenantFilter(p.qual);
  const checkOk = isTenantFilter(p.check);
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
  tableForeignKeys: ForeignKeyRow[],
  classification: TableClassification,
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
    // A surrogate uuid primary key may stand alone; any other key would reveal other tenants'
    // values through unique violations.
    const surrogateKey = ix.primary && ix.keys === 1 && ix.lead_uuid;
    if (!surrogateKey && ix.lead !== 'tenant_id') {
      out.push(`${t}: index ${ix.index} does not lead with tenant_id (ADR-0004)`);
    }
  }
  for (const fk of tableForeignKeys) {
    const target = Object.hasOwn(classification, fk.ref_table)
      ? classification[fk.ref_table]
      : undefined;
    if (target && target.kind !== 'tenant') continue; // global and system rows hold no tenant data
    if (fk.lead !== 'tenant_id' || fk.ref_lead !== 'tenant_id') {
      out.push(
        `${t}: foreign key ${fk.name} to ${fk.ref_table} must lead with tenant_id on both sides (FK checks ignore RLS)`,
      );
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
  const rels = await relations(db);
  const [pols, idxs, fks] = [await policies(db), await indexes(db), await foreignKeys(db)];
  const out: string[] = await relationsOutsidePublic(db);
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
          fks.filter((k) => k.table === rel.name),
          classification,
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
