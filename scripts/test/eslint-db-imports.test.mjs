// ADR-0005: raw pool and session access is blocked by lint outside packages/db.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';
import { createConfig } from '../../tooling/eslint-config/index.js';

const root = join(import.meta.dirname, '..', '..');

/** The import-restriction block of the shared config, linted without type information. */
function restrictionBlock(options) {
  const block = createConfig({ tsconfigRootDir: root, ...options }).find(
    (c) => c.rules?.['no-restricted-imports'],
  );
  assert.ok(block, 'createConfig must contain the no-restricted-imports block');
  return block;
}

async function restrictedImports(code, filePath, { cwd = root, ...options } = {}) {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [restrictionBlock(options)],
  });
  const [result] = await eslint.lintText(code, { filePath: join(cwd, filePath) });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports').length;
}

describe('raw database imports', () => {
  it('fail lint in any other package', async () => {
    const file = 'packages/testing/src/fixture.ts';
    assert.equal(
      await restrictedImports("import { Pool } from 'pg';\nexport { Pool };\n", file),
      1,
    );
    assert.equal(await restrictedImports("import pg from 'pg';\nexport { pg };\n", file), 1);
    assert.equal(
      await restrictedImports(
        "import { drizzle } from 'drizzle-orm/node-postgres';\nexport { drizzle };\n",
        file,
      ),
      1,
    );
    assert.equal(
      await restrictedImports(
        "import { PgTransaction } from 'drizzle-orm/pg-core';\nexport { PgTransaction };\n",
        file,
      ),
      1,
    );
  });

  it('allow schema builders from drizzle-orm/pg-core', async () => {
    const file = 'packages/testing/src/fixture.ts';
    assert.equal(
      await restrictedImports(
        "import { pgTable } from 'drizzle-orm/pg-core';\nexport { pgTable };\n",
        file,
      ),
      0,
    );
  });

  it('pass in the folders a package allows (packages/db src and test-harness)', async () => {
    const cwd = join(root, 'packages', 'db');
    const opts = { cwd, allowRawDb: ['src/**', 'test-harness/**'] };
    const code = "import { Pool } from 'pg';\nexport { Pool };\n";
    assert.equal(await restrictedImports(code, 'src/client.ts', opts), 0);
    assert.equal(await restrictedImports(code, 'test-harness/setup.ts', opts), 0);
    assert.equal(await restrictedImports(code, 'test/roles.test.ts', opts), 1);
  });
});
