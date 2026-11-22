// Spec 0.4 criterion 7 and the spec's edge cases (slice 0.4-04): the public API of @shifa/ui never
// shows which library is underneath. The declarations TypeScript would emit for src/index.ts and
// everything it exports must not name a @ui-sdk/* or Base UI type, so a fallback swap (ADR-0039)
// never changes what an app imports or types against.
import { join } from 'node:path';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { GATE_COMPONENTS } from './gate-components.ts';

const pkgDir = join(import.meta.dirname, '..');
const entry = join(pkgDir, 'src', 'index.ts');

/** The emitted declaration files of the package entry and the modules it reaches, by path. */
function emitDeclarations(): Map<string, string> {
  const configPath = join(pkgDir, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, (path) => ts.sys.readFile(path));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, pkgDir);
  const options: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    sourceMap: false,
    declarationMap: false,
    outDir: join(pkgDir, '.public-api-dts'),
  };
  const program = ts.createProgram([entry], options);
  const out = new Map<string, string>();
  program.emit(undefined, (fileName, text) => {
    out.set(fileName, text);
  });
  return out;
}

describe('public API of @shifa/ui', () => {
  let declarations: Map<string, string>;
  let api: Record<string, unknown>;
  beforeAll(async () => {
    declarations = emitDeclarations();
    api = await import('../src/index.ts');
  }, 60_000);

  it('emits declarations for the entry', () => {
    expect([...declarations.keys()].some((f) => f.endsWith('index.d.ts'))).toBe(true);
  });

  it('names no @ui-sdk or Base UI type in any exported declaration', () => {
    const leaks = [...declarations]
      .filter(([, text]) => /@ui-sdk\/|@base-ui\/|@base-ui-components\//.test(text))
      .map(([file]) => file.slice(pkgDir.length));
    expect(leaks).toEqual([]);
  });

  it('names no TanStack type: the data table shows its own column type (slice 0.4-07)', () => {
    const leaks = [...declarations]
      .filter(([, text]) => text.includes('@tanstack/'))
      .map(([file]) => file.slice(pkgDir.length));
    expect(leaks).toEqual([]);
    expect(typeof api['DataTable']).toBe('function');
  });

  it.each(GATE_COMPONENTS)('exports $name', ({ name }) => {
    expect(typeof api[name.replace(' ', '')]).toBe('function');
  });
});
