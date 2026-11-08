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
    for (const { fileName } of ts.preProcessFile(text, true, true).importedFiles) {
      const reason = boundaryViolation(srcRoot, file, fileName);
      if (reason) violations.push(`${name} → ${fileName} (${reason})`);
    }
    if (SILENCED.test(text)) violations.push(`${name} silences shifa/module-boundaries`);
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
    });
    expect(findViolations(src).violations.sort()).toEqual([
      'access/x.ts → ../modules/b/index.ts (layerImport)',
      'modules/a/a.ts → ../b/b.ts (deepImport)',
      'platform/y.ts → @/modules/a/a.ts (layerImport)',
    ]);
  });

  it('fail a fixture tree that silences the rule', () => {
    const src = fixture({
      'modules/a/a.ts':
        "// eslint-disable-next-line shifa/module-boundaries\nimport { B } from '../b/index.ts';\nexport const A = B;\n",
      'modules/b/index.ts': 'export const B = 1;\n',
      'modules/c/c.ts': '/* eslint shifa/module-boundaries: off */\nexport const C = 1;\n',
    });
    expect(findViolations(src).violations.sort()).toEqual([
      'modules/a/a.ts silences shifa/module-boundaries',
      'modules/c/c.ts silences shifa/module-boundaries',
    ]);
  });
});
