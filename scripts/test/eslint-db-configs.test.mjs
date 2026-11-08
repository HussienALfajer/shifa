// The raw-database lint rule as the packages really run it (their own eslint.config.js,
// type-aware parser), including dynamic imports, other drivers and @shifa/db/testing.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ESLint } from 'eslint';

const root = join(import.meta.dirname, '..', '..');
const RULES = new Set(['no-restricted-imports', 'no-restricted-syntax']);

/** Lints `code` as if it were the existing file `file` of `pkg`; counts DB-rule errors. */
async function dbErrors(pkg, file, code) {
  const cwd = join(root, 'packages', pkg);
  const eslint = new ESLint({ cwd });
  const [result] = await eslint.lintText(code, { filePath: join(cwd, file) });
  return result.messages.filter((m) => RULES.has(m.ruleId)).length;
}

describe('real package configs', () => {
  it('block raw drivers in another package, however they are loaded', async () => {
    const cases = [
      "import { Pool } from 'pg';\nexport const p = Pool;\n",
      "export const m = await import('pg');\n",
      "import { createRequire } from 'node:module';\nexport const m: unknown = createRequire(import.meta.url)('pg');\n",
      "import { drizzle } from 'drizzle-orm/pglite';\nexport const d = drizzle;\n",
      "import pgNative from 'pg-native';\nexport const n: unknown = pgNative;\n",
      "import { ownerDb } from '@shifa/db/testing';\nexport const o = ownerDb;\n",
    ];
    for (const code of cases) {
      assert.ok((await dbErrors('testing', 'src/clock.ts', code)) >= 1, code);
    }
    assert.equal(
      await dbErrors(
        'testing',
        'src/clock.ts',
        "import { sql } from 'drizzle-orm';\nexport const s = sql;\n",
      ),
      0,
    );
  });

  it('allow @shifa/db/testing in test files only', async () => {
    const code = "import { ownerDb } from '@shifa/db/testing';\nexport const o = ownerDb;\n";
    assert.equal(await dbErrors('testing', 'test/clock.test.ts', code), 0);
    assert.equal(
      await dbErrors(
        'testing',
        'test/clock.test.ts',
        "import pg from 'pg';\nexport const p: unknown = pg;\n",
      ),
      1,
    );
  });

  it('allow raw access in packages/db src and test-harness only', async () => {
    const code = "import { Pool } from 'pg';\nexport const p = Pool;\n";
    assert.equal(await dbErrors('db', 'src/client.ts', code), 0);
    assert.equal(await dbErrors('db', 'test-harness/index.ts', code), 0);
    assert.equal(await dbErrors('db', 'test/roles.test.ts', code), 1);
    assert.equal(await dbErrors('db', 'vitest.db.config.ts', code), 1);
  });
});
