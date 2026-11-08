// Guards added after review: a rename counts as drift (not a crash), and --fix never writes
// a migration into the committed folder.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { runDrift } from '../lib/drift.mjs';
import { migrationsCheck } from '../lib/drift-migrations.mjs';

const realDb = join(import.meta.dirname, '..', '..', 'packages', 'db');
const table = (column) =>
  [
    "import { pgTable, text } from 'drizzle-orm/pg-core';",
    `export const probe = pgTable('drift_probe', { ${column}: text('${column}') });`,
  ].join('\n');

let root;
let db;

beforeEach(() => {
  // Same layout as drift-migrations.test.mjs: only drizzle-kit and drizzle-orm are linked.
  root = mkdtempSync(join(tmpdir(), 'drift-guard-'));
  db = join(root, 'packages', 'db');
  mkdirSync(join(db, 'node_modules'), { recursive: true });
  for (const entry of ['drizzle.config.ts', 'package.json', 'src', 'migrations']) {
    cpSync(join(realDb, entry), join(db, entry), { recursive: true });
  }
  for (const pkg of ['drizzle-kit', 'drizzle-orm']) {
    const target = realpathSync(join(realDb, 'node_modules', pkg));
    symlinkSync(target, join(db, 'node_modules', pkg), 'junction');
  }
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const check = () => migrationsCheck({ dbDir: 'packages/db', mainFolders: null });

describe('migrations check guards', () => {
  it('is never fixable: --fix leaves the committed folders unchanged', async () => {
    writeFileSync(join(db, 'src', 'schema', 'index.ts'), table('alpha'));
    const before = readdirSync(join(db, 'migrations'));
    const { code, results } = await runDrift({ root, checks: [check()], logDir: root, fix: true });
    assert.equal(code, 1);
    assert.equal(results[0].status, 'drift');
    assert.deepEqual(readdirSync(join(db, 'migrations')), before);
  });

  it('reports a renamed column without a migration as drift, not a crash', async () => {
    writeFileSync(join(db, 'src', 'schema', 'index.ts'), table('alpha'));
    const bin = join(db, 'node_modules', 'drizzle-kit', 'bin.cjs');
    const gen = spawnSync(process.execPath, [bin, 'generate', '--name', 'probe'], {
      cwd: db,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    assert.equal(gen.status, 0, String(gen.stderr));
    writeFileSync(join(db, 'src', 'schema', 'index.ts'), table('beta'));
    const { code, results } = await runDrift({ root, checks: [check()], logDir: root });
    assert.equal(code, 1, JSON.stringify(results));
    assert.match(results[0].problems.join('\n'), /\/db-migration/);
  });
});
