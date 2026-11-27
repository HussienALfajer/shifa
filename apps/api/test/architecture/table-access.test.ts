// A-01b criterion 8: modules read and write only their own tables. Each module may import from
// @shifa/db only the tables it owns, plus the reads listed below with their reason; anything
// else (a new module reaching into team or identity tables) fails here. A table reached through
// EXCEPTIONS may only be read: `.insert(t)`, `.update(t)` or `.delete(t)` on it fails unless
// WRITES lists it with its reason (A-01-05). Companion of module-imports.test.ts, which checks
// how modules import each other.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as shifaDb from '@shifa/db';
import { is, Table } from 'drizzle-orm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', '..', 'src');

/** Tables each module owns (writes and reads). */
const OWNED: Readonly<Record<string, readonly string[]>> = {
  health: [],
  identity: [
    'user',
    'session',
    'account',
    'verification',
    'twoFactor',
    'platformAdmin',
    'authThrottle',
    'auditEvent',
  ],
  platform: ['tenant', 'auditEvent'],
  entitlements: [
    'plan',
    'planFeature',
    'addon',
    'tenantAddon',
    'tenantOverride',
    'tenantOverrideEvent',
  ],
  branches: ['branch', 'auditEvent'],
  team: ['membership', 'roleAssignment', 'permissionOverride', 'setupLink', 'auditEvent'],
  // A-02-03
  flags: ['featureFlag', 'featureFlagTenant'],
  capabilities: [],
  // A-02-04: the settings cascade, and the owner's change of the idle sign-out (audited)
  settings: ['settingValue', 'platformSettingValue', 'auditEvent'],
  // A-02-05: support grants (open, hand off, end, the owner's end, every request audited)
  support: ['supportAccessGrant', 'auditEvent'],
};

/** Tables a module reaches outside what it owns, each with its reason. */
const EXCEPTIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  identity: {
    tenant:
      'the principal reads the active clinic’s idle limit and status; the chooser lists clinics',
    membership: 'the principal and sign-in read the person’s own memberships; a link binds one',
    roleAssignment: 'the principal’s roles in the active clinic (read per request)',
    permissionOverride: 'the principal’s toggles in the active clinic (read per request)',
    branch:
      'read: the active branch is checked against the clinic; the chooser and an invitation name branches',
    setupLink: 'opening and using a link on the auth path, by its token hash alone',
    supportAccessGrant:
      'a support session reads its grant per request; a hand-off finds it by its token hash (A-02-05)',
  },
  support: {
    tenant: 'read: a grant is opened on an existing clinic, suspended too (A-02 criterion 14)',
    membership: 'read: the ending owner’s name, shown on the support tab’s ended page',
  },
  platform: {
    membership: 'the owner card of a clinic (owner memberships only, by policy)',
  },
  entitlements: {
    tenant: 'a clinic’s type is its plan (A-02 criterion 1); read only',
  },
  flags: {
    tenant: 'read: the flags list names the selected clinics; a selection must name a clinic',
  },
  capabilities: {
    tenant: 'read: the subscription card shows the clinic’s plan, status and end date (A-02 6)',
  },
  branches: {
    membership: 'read: the members whose sessions end when a branch is archived (A-01b 4, 9)',
    roleAssignment: 'read: who holds a role in a branch (cards, archive preview)',
  },
  team: {
    branch: 'read: a role assignment names an active branch of the clinic',
  },
  settings: {
    tenant: 'read: a clinic’s type is its plan, whose setting values apply (A-02 criterion 8)',
  },
};

/** Exception tables a module also writes, each with its reason. */
const WRITES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  identity: {
    membership: 'accepting a link or an invitation binds it; a request stamps last_active_at',
    setupLink: 'using a link marks it used, on the auth path',
    supportAccessGrant:
      'a hand-off is used once (its hash cleared); an expired grant is closed as `expiry`, once',
  },
};

const WRITE_METHODS = new Set(['insert', 'update', 'delete']);

/** Export name → is it a table, from the real package. */
const TABLES = new Set(
  Object.entries(shifaDb)
    .filter(([, value]) => is(value, Table))
    .map(([name]) => name),
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

const fromDb = (node: ts.Statement): node is ts.ImportDeclaration | ts.ExportDeclaration =>
  (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
  node.moduleSpecifier !== undefined &&
  ts.isStringLiteral(node.moduleSpecifier) &&
  node.moduleSpecifier.text === '@shifa/db';

/** Every name imported from '@shifa/db' (or `import * as`, reported as '*'). */
function dbImports(source: ts.SourceFile): string[] {
  const names: string[] = [];
  for (const node of source.statements) {
    if (!fromDb(node)) continue;
    if (ts.isImportDeclaration(node)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) names.push('*');
      if (bindings && ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) names.push((el.propertyName ?? el.name).text);
      }
    } else if (node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const el of node.exportClause.elements) names.push((el.propertyName ?? el.name).text);
    } else {
      names.push('*');
    }
  }
  return names;
}

/** Tables (export names) passed to `.insert()`, `.update()` or `.delete()` in `source`. */
function dbWrites(source: ts.SourceFile): string[] {
  const local = new Map<string, string>();
  for (const node of source.statements) {
    if (!fromDb(node) || !ts.isImportDeclaration(node)) continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements)
        local.set(el.name.text, (el.propertyName ?? el.name).text);
    }
  }
  const writes: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      WRITE_METHODS.has(node.expression.name.text)
    ) {
      const [target] = node.arguments;
      const table = target && ts.isIdentifier(target) ? local.get(target.text) : undefined;
      if (table !== undefined) writes.push(table);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return writes;
}

interface Scan {
  /** `file → table` imports and `file writes table` writes that break the lists. */
  problems: string[];
  /** `module → table` for every write to a table the module does not own. */
  exceptionWrites: string[];
}

function scan(modulesRoot: string): Scan {
  const problems: string[] = [];
  const found = new Set<string>();
  for (const module of readdirSync(modulesRoot)) {
    const owned = new Set(OWNED[module] ?? []);
    const allowed = new Set([...owned, ...Object.keys(EXCEPTIONS[module] ?? {})]);
    const writable = new Set([...owned, ...Object.keys(WRITES[module] ?? {})]);
    if (!(module in OWNED)) problems.push(`${module}: module without a table list`);
    for (const file of sourceFiles(join(modulesRoot, module))) {
      const name = relative(modulesRoot, file).replaceAll('\\', '/');
      const text = readFileSync(file, 'utf8');
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
      for (const imported of dbImports(source)) {
        if (imported === '*') problems.push(`${name} → * (namespace import of @shifa/db)`);
        else if (TABLES.has(imported) && !allowed.has(imported)) {
          problems.push(`${name} → ${imported}`);
        }
      }
      for (const table of new Set(dbWrites(source))) {
        if (!owned.has(table)) found.add(`${module} → ${table}`);
        if (allowed.has(table) && !writable.has(table)) problems.push(`${name} writes ${table}`);
      }
    }
  }
  return { problems: problems.sort(), exceptionWrites: [...found].sort() };
}

/** Every import and write of a module that its lists do not allow. */
export function tableViolations(modulesRoot: string): string[] {
  return scan(modulesRoot).problems;
}

describe('module table access', () => {
  it('knows the tables of @shifa/db', () => {
    expect(TABLES).toContain('membership');
    expect(TABLES).toContain('user');
    expect(TABLES).not.toContain('createClinic');
  });

  it('every module imports only its own tables and the listed reads', () => {
    expect(tableViolations(join(SRC, 'modules'))).toEqual([]);
  });

  it('every listed table exists', () => {
    const lists = [
      ...Object.values(OWNED),
      ...Object.values(EXCEPTIONS).map(Object.keys),
      ...Object.values(WRITES).map(Object.keys),
    ];
    for (const list of lists) {
      for (const table of list) expect(TABLES, table).toContain(table);
    }
  });

  it('the branches module owns `branch`; team and identity only read it', () => {
    expect(OWNED['branches']).toEqual(['branch', 'auditEvent']);
    expect(Object.keys(EXCEPTIONS['team'] ?? {})).toContain('branch');
    expect(Object.keys(WRITES['team'] ?? {})).not.toContain('branch');
    expect(Object.keys(WRITES['identity'] ?? {})).not.toContain('branch');
  });

  it('every WRITES entry is an exception of its module and is used', () => {
    const listed = Object.entries(WRITES).flatMap(([module, tables]) =>
      Object.keys(tables).map((table) => {
        expect(Object.keys(EXCEPTIONS[module] ?? {}), `${module} → ${table}`).toContain(table);
        return `${module} → ${table}`;
      }),
    );
    expect(scan(join(SRC, 'modules')).exceptionWrites).toEqual(listed.sort());
  });

  it('red: a module reaching into another module’s tables fails', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'shifa-table-access-'));
    try {
      mkdirSync(join(root, 'team'));
      mkdirSync(join(root, 'reports'));
      writeFileSync(
        join(root, 'team', 'x.ts'),
        "import { membership, session as s } from '@shifa/db';\nexport { membership, s };\n",
      );
      writeFileSync(
        join(root, 'reports', 'r.ts'),
        "import * as db from '@shifa/db';\nexport { db };\n",
      );
      expect(tableViolations(root)).toEqual([
        'reports/r.ts → * (namespace import of @shifa/db)',
        'reports: module without a table list',
        'team/x.ts → session',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('red: a write to a table reached only for reads fails', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'shifa-table-writes-'));
    try {
      mkdirSync(join(root, 'team'));
      mkdirSync(join(root, 'platform'));
      writeFileSync(
        join(root, 'team', 'w.ts'),
        [
          "import { branch as b, membership } from '@shifa/db';",
          'export const w = (tx: any) => [',
          "  tx.update(b).set({ name: 'x' }),",
          '  tx.insert(membership).values({}),',
          '  tx.select().from(b),',
          '];',
          '',
        ].join('\n'),
      );
      writeFileSync(
        join(root, 'platform', 'p.ts'),
        "import { membership } from '@shifa/db';\nexport const p = (tx: any) => tx.delete(membership);\n",
      );
      // team owns membership; branch and platform's membership are read-only exceptions.
      expect(tableViolations(root)).toEqual([
        'platform/p.ts writes membership',
        'team/w.ts writes branch',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
