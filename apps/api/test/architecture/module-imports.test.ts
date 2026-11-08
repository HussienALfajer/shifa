// ADR-0003 module boundaries on the real source tree, with the same check as the lint rule
// (shifa/module-boundaries). Lint can be silenced with a comment; this test cannot, and it also
// fails on any comment that tries.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { boundaryViolation } from '@shifa/eslint-config/rules/module-boundaries';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';

const SOURCE = /\.(?:[cm]?ts|tsx|[cm]?js)$/;
/** eslint-disable(-next-line|-line) or an inline `eslint` config comment naming the rule. */
const SILENCED = /eslint(?:-disable[\w-]*)?\s[^\n]*shifa\/module-boundaries/;
/** A blanket eslint-disable (no rule list), which silences this rule too. */
const BLANKET = /eslint-disable(?:-next-line|-line)?[ \t]*(?:--|\*\/|$)/m;
/** Folders whose files must not load a module through a computed import()/require(). */
const CHECKED = new Set(['modules', 'platform', 'access']);

/**
 * Every module specifier in `file`, parsed (no type check): imports, re-exports
 * (`export * as ns from` included), `import x = require()`, `typeof import()` and
 * `import()`/`require()` calls. A computed specifier is `null`.
 */
function specifiers(file: string, text: string): (string | null)[] {
  const found: (string | null)[] = [];
  const literal = (node: ts.Node | undefined): string | null =>
    node && ts.isStringLiteralLike(node) ? node.text : null;
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) found.push(literal(node.moduleSpecifier));
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      found.push(literal(node.moduleReference.expression));
    } else if (ts.isImportTypeNode(node)) {
      const arg = node.argument;
      found.push(ts.isLiteralTypeNode(arg) ? literal(arg.literal) : null);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      found.push(literal(node.arguments[0]));
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true));
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE.test(entry.name) ? [path] : [];
  });
}

/** Every boundary violation under `srcRoot`, as `file → import (reason)`. */
function findViolations(srcRoot: string): { files: number; violations: string[] } {
  const files = sourceFiles(srcRoot);
  const violations: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const name = relative(srcRoot, file).replaceAll('\\', '/');
    for (const specifier of specifiers(file, text)) {
      if (specifier === null) {
        if (CHECKED.has(name.split('/')[0] ?? '')) {
          violations.push(`${name} → <computed> (computedImport)`);
        }
        continue;
      }
      const reason = boundaryViolation(srcRoot, file, specifier);
      if (reason) violations.push(`${name} → ${specifier} (${reason})`);
    }
    if (SILENCED.test(text) || BLANKET.test(text)) {
      violations.push(`${name} silences shifa/module-boundaries`);
    }
  }
  return { files: files.length, violations };
}

const tempDirs: string[] = [];

/** A throw-away src/ tree from `{ 'modules/a/a.ts': code }`. */
function fixture(tree: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'shifa-module-imports-'));
  tempDirs.push(dir);
  const src = join(dir, 'src');
  for (const [rel, code] of Object.entries(tree)) {
    const path = join(src, ...rel.split('/'));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, code);
  }
  return src;
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe('module boundaries', () => {
  it('hold on the real source tree', () => {
    const { files, violations } = findViolations(join(import.meta.dirname, '..', '..', 'src'));
    expect(files).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  });

  it('pass a clean fixture tree', () => {
    const src = fixture({
      'modules/a/a.ts': "import { B } from '../b/index.ts';\nexport const A = B;\n",
      'modules/a/index.ts': "export * from './a.ts';\n",
      'modules/b/index.ts': 'export const B = 1;\n',
      'platform/p.ts': "import { E } from './e.ts';\nexport const P = E;\n",
      'platform/e.ts': 'export const E = 1;\n',
    });
    expect(findViolations(src).violations).toEqual([]);
  });

  it('fail a fixture tree with deep and layer imports', () => {
    const src = fixture({
      'modules/a/a.ts': "import { B } from '../b/b.ts';\nexport const A = B;\n",
      'modules/b/b.ts': 'export const B = 1;\n',
      'modules/b/index.ts': "export * from './b.ts';\n",
      'access/x.ts': "export const m = await import('../modules/b/index.ts');\n",
      'platform/y.ts': "export * from '@/modules/a/a.ts';\n",
      // Forms ts.preProcessFile misses, backslash paths and computed specifiers.
      'modules/a/ns.ts': "export * as ns from '../b/b.ts';\nexport type * as t from '../b/b.ts';\n",
      'modules/a/bs.ts': "import type { B } from '..\\\\b\\\\b.ts';\nexport type { B };\n",
      'modules/a/rx.ts': "const r = /`/;\nexport { B } from '../b/b.ts';\nexport const R = r;\n",
      'modules/a/dyn.ts': 'export const load = (p: string) => import(p);\n',
      'modules/a/tpl.ts': 'export const m = await import(`../b/b.ts`);\n',
      'modules/a/ty.ts': "export type T = typeof import('../b/b.ts');\n",
    });
    expect(findViolations(src).violations.sort()).toEqual([
      'access/x.ts → ../modules/b/index.ts (layerImport)',
      'modules/a/a.ts → ../b/b.ts (deepImport)',
      'modules/a/bs.ts → ..\\b\\b.ts (deepImport)',
      'modules/a/dyn.ts → <computed> (computedImport)',
      'modules/a/ns.ts → ../b/b.ts (deepImport)',
      'modules/a/ns.ts → ../b/b.ts (deepImport)',
      'modules/a/rx.ts → ../b/b.ts (deepImport)',
      'modules/a/tpl.ts → ../b/b.ts (deepImport)',
      'modules/a/ty.ts → ../b/b.ts (deepImport)',
      'platform/y.ts → @/modules/a/a.ts (layerImport)',
    ]);
  });

  it('fail a fixture tree that silences the rule', () => {
    const src = fixture({
      'modules/a/a.ts':
        "// eslint-disable-next-line shifa/module-boundaries\nimport { B } from '../b/index.ts';\nexport const A = B;\n",
      'modules/b/index.ts': 'export const B = 1;\n',
      'modules/c/c.ts': '/* eslint shifa/module-boundaries: off */\nexport const C = 1;\n',
      // Blanket disables name no rule but silence this one too.
      'modules/d/d.ts': '/* eslint-disable */\nexport const D = 1;\n',
      'modules/e/e.ts': '// eslint-disable-next-line -- reason\nexport const E = 1;\n',
      'modules/f/f.ts': '// eslint-disable-line\nexport const F = 1;\n',
    });
    expect(findViolations(src).violations.sort()).toEqual([
      'modules/a/a.ts silences shifa/module-boundaries',
      'modules/c/c.ts silences shifa/module-boundaries',
      'modules/d/d.ts silences shifa/module-boundaries',
      'modules/e/e.ts silences shifa/module-boundaries',
      'modules/f/f.ts silences shifa/module-boundaries',
    ]);
  });
});
