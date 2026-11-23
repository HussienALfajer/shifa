// A-01b criterion 8: modules read and write only their own tables. Each module may import from
// @shifa/db only the tables it owns, plus the reads listed below with their reason; anything
// else (a new module reaching into team or identity tables) fails here. Companion of
// module-imports.test.ts, which checks how modules import each other.
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
  team: ['membership', 'roleAssignment', 'permissionOverride', 'setupLink', 'auditEvent'],
};

/** Tables a module reaches outside what it owns, each with its reason. */
const EXCEPTIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  identity: {
    tenant: 'the principal reads the active clinic’s idle limit; a link page shows its clinic',
    membership: 'the principal and sign-in read the person’s own memberships; a link binds one',
    roleAssignment: 'the principal’s roles in the active clinic (read per request)',
    permissionOverride: 'the principal’s toggles in the active clinic (read per request)',
    branch: 'the active branch is checked against the clinic; an invitation names its branches',
    setupLink: 'opening and using a link on the auth path, by its token hash alone',
  },
  platform: {
    membership: 'the owner card of a clinic (owner memberships only, by policy)',
  },
  team: {
    branch: 'a role assignment names a branch of the clinic (branch routes come with A-01-05)',
    tenant: 'the clinic’s own settings row (idle minutes, A-01a 9)',
  },
};

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

/** Every name imported from '@shifa/db' (or `import * as`, reported as '*') in `text`. */
function dbImports(file: string, text: string): string[] {
  const names: string[] = [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    const spec = node.moduleSpecifier;
    if (!spec || !ts.isStringLiteral(spec) || spec.text !== '@shifa/db') continue;
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

/** `module/file → table` for every table a module imports without owning it or a reason. */
export function tableViolations(modulesRoot: string): string[] {
  const problems: string[] = [];
  for (const module of readdirSync(modulesRoot)) {
    const allowed = new Set([...(OWNED[module] ?? []), ...Object.keys(EXCEPTIONS[module] ?? {})]);
    if (!(module in OWNED)) problems.push(`${module}: module without a table list`);
    for (const file of sourceFiles(join(modulesRoot, module))) {
      const name = relative(modulesRoot, file).replaceAll('\\', '/');
      for (const imported of dbImports(file, readFileSync(file, 'utf8'))) {
        if (imported === '*') problems.push(`${name} → * (namespace import of @shifa/db)`);
        else if (TABLES.has(imported) && !allowed.has(imported)) {
          problems.push(`${name} → ${imported}`);
        }
      }
    }
  }
  return problems.sort();
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
    for (const list of [...Object.values(OWNED), ...Object.values(EXCEPTIONS).map(Object.keys)]) {
      for (const table of list) expect(TABLES, table).toContain(table);
    }
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
});
