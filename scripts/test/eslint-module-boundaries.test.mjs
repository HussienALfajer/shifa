// ADR-0003: API modules import each other only through index.ts; platform/ and access/ never
// import a module. Rule cases (RuleTester) and the rule as the packages really run it.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ESLint, RuleTester } from 'eslint';
import { createConfig } from '../../tooling/eslint-config/index.js';
import { moduleBoundariesRule } from '../../tooling/eslint-config/rules/module-boundaries.js';

const root = join(import.meta.dirname, '..', '..');
const api = join(root, 'apps', 'api');
const srcRoot = join(api, 'src');
const RULE_ID = 'shifa/module-boundaries';

// The TypeScript parser the shared config uses (type imports, import = require()).
const parser = createConfig({ tsconfigRootDir: root }).find((c) => c.languageOptions?.parser)
  ?.languageOptions.parser;
assert.ok(parser, 'the shared config must set a parser');

const tester = new RuleTester({ languageOptions: { parser } });
const options = [{ srcRoot }];
const file = (rel) => join(srcRoot, ...rel.split('/'));

/** A valid case for `code` in the src-relative file `rel`. */
const ok = (rel, code) => ({ filename: file(rel), code, options });
/** An invalid case: every import in `code` is one violation. */
const bad = (rel, code, messageId, count = 1) => ({
  filename: file(rel),
  code,
  options,
  errors: Array.from({ length: count }, () => ({ messageId })),
});

describe('module-boundaries rule', () => {
  it('runs the RuleTester cases', () => {
    tester.run('module-boundaries', moduleBoundariesRule, {
      valid: [
        // Another module through its index.ts (with or without extension, or the folder).
        ok('modules/a/a.service.ts', "import { B } from '../b/index.ts';\nexport { B };"),
        ok('modules/a/a.service.ts', "import { B } from '../b/index.js';\nexport { B };"),
        ok('modules/a/a.service.ts', "import { B } from '../b';\nexport { B };"),
        ok('modules/a/deep/x.ts', "export { B } from '../../b/index.ts';"),
        // Same-module deep import.
        ok('modules/a/a.controller.ts', "import { S } from './a.service.ts';\nexport { S };"),
        ok('modules/a/deep/x.ts', "import { S } from '../a.service.ts';\nexport { S };"),
        // Modules may use platform/ and access/.
        ok(
          'modules/a/a.ts',
          "import { D } from '../../platform/database.module.ts';\nexport { D };",
        ),
        ok('modules/a/a.ts', "import { P } from '@/access/index.ts';\nexport { P };"),
        // Packages and the root of src are not modules.
        ok('modules/a/a.ts', "import { Module } from '@nestjs/common';\nexport { Module };"),
        ok('app.module.ts', "import { H } from './modules/health/index.ts';\nexport { H };"),
        ok('platform/x.ts', "import { E } from './errors.ts';\nexport { E };"),
        // A computed import() cannot be resolved here; the architecture test refuses it.
        ok('modules/a/a.ts', 'export const load = (p) => import(p);'),
      ],
      invalid: [
        bad(
          'modules/a/a.ts',
          "import { B } from '../b/b.service.ts';\nexport { B };",
          'deepImport',
        ),
        bad(
          'modules/a/deep/x.ts',
          "import { B } from '../../b/x/y.ts';\nexport { B };",
          'deepImport',
        ),
        bad(
          'modules/a/a.ts',
          "import type { B } from '../b/b.types.ts';\nexport type { B };",
          'deepImport',
        ),
        bad('modules/a/a.ts', "export { B } from '../b/b.service.ts';", 'deepImport'),
        bad('modules/a/a.ts', "export * from '../b/b.service.ts';", 'deepImport'),
        bad('modules/a/a.ts', "export const m = await import('../b/b.service.ts');", 'deepImport'),
        bad(
          'modules/a/a.ts',
          "import { B } from '@/modules/b/b.service.ts';\nexport { B };",
          'deepImport',
        ),
        bad(
          'modules/a/a.ts',
          "import b = require('../b/b.service.ts');\nexport { b };",
          'deepImport',
        ),
        bad('modules/a/a.ts', "export * as ns from '../b/b.service.ts';", 'deepImport'),
        bad('modules/a/a.ts', 'export const m = await import(`../b/b.service.ts`);', 'deepImport'),
        bad('modules/a/a.ts', "export type T = typeof import('../b/b.service.ts');", 'deepImport'),
        // Backslash separators (tsc resolves them on Windows) and absolute paths.
        bad(
          'modules/a/a.ts',
          "import type { B } from '..\\\\b\\\\b.service.ts';\nexport type { B };",
          'deepImport',
        ),
        bad(
          'modules/a/a.ts',
          `import { B } from '${file('modules/b/b.service.ts').replaceAll('\\', '/')}';\nexport { B };`,
          'deepImport',
        ),
        // platform/ and access/ never import a module, not even its index.ts.
        bad(
          'platform/x.ts',
          "import { H } from '../modules/health/index.ts';\nexport { H };",
          'layerImport',
        ),
        bad(
          'access/x.ts',
          "import { H } from '../modules/health/health.service.ts';\nexport { H };",
          'layerImport',
        ),
        bad('access/deep/x.ts', "export * from '@/modules/health/index.ts';", 'layerImport'),
        bad(
          'platform/x.ts',
          "export const m = await import('../modules/a/index.ts');",
          'layerImport',
        ),
        bad(
          'modules/a/a.ts',
          "import { B } from '../b/b.ts';\nimport { C } from '../c/c.ts';\nexport { B, C };",
          'deepImport',
          2,
        ),
      ],
    });
  });
});

describe('shared config', () => {
  it('adds the rule only when moduleBoundaries is passed', () => {
    const withRule = createConfig({ tsconfigRootDir: api, moduleBoundaries: { root: 'src' } });
    const block = withRule.find((c) => c.rules?.[RULE_ID]);
    assert.ok(block, 'createConfig({ moduleBoundaries }) must enable the rule');
    assert.deepEqual(block.rules[RULE_ID], ['error', { srcRoot }]);
    const without = createConfig({ tsconfigRootDir: api });
    assert.equal(
      without.some((c) => c.rules?.[RULE_ID]),
      false,
    );
  });
});

/** Rule errors when `code` is linted as the existing file `rel` of `pkg` with its real config. */
async function realErrors(pkg, rel, code) {
  const cwd = join(root, pkg);
  const filePath = join(cwd, rel);
  assert.ok(existsSync(filePath), `${filePath} must exist for a real lint run`);
  const [result] = await new ESLint({ cwd }).lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === RULE_ID).length;
}

describe('real package configs', () => {
  it('enforce the boundary in the API', async () => {
    const deep = "import { X } from '../other/other.service.ts';\nexport { X };\n";
    assert.equal(await realErrors('apps/api', 'src/modules/health/health.service.ts', deep), 1);
    const layer = "import { H } from '../modules/health/index.ts';\nexport { H };\n";
    assert.equal(await realErrors('apps/api', 'src/platform/errors.ts', layer), 1);
  });

  it('leave other packages alone', async () => {
    const cwd = join(root, 'packages', 'db');
    const config = await new ESLint({ cwd }).calculateConfigForFile(join(cwd, 'src', 'index.ts'));
    assert.ok(config.rules, 'packages/db must have a lint config');
    assert.equal(config.rules[RULE_ID], undefined);
  });
});
