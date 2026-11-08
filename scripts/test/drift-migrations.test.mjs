import assert from 'node:assert/strict';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { runDrift } from '../lib/drift.mjs';
import { folderProblems, migrationsCheck } from '../lib/drift-migrations.mjs';

const repo = join(import.meta.dirname, '..', '..');
const realDb = join(repo, 'packages', 'db');

function migrationsDir(folders) {
  const dir = mkdtempSync(join(tmpdir(), 'drift-mig-'));
  for (const [name, files] of Object.entries(folders)) {
    mkdirSync(join(dir, name));
    for (const file of files) writeFileSync(join(dir, name, file), '{}');
  }
  return dir;
}

const both = ['migration.sql', 'snapshot.json'];

describe('folderProblems', () => {
  it('accepts well-formed folders in order', () => {
    const dir = migrationsDir({ '20261108032219_baseline': both, '20261109100000_tenants': both });
    assert.deepEqual(folderProblems(dir, { mainFolders: ['20261108032219_baseline'] }), []);
  });

  it('rejects a bad folder name', () => {
    const dir = migrationsDir({ '2026-11-08_baseline': both });
    const problems = folderProblems(dir, { mainFolders: null });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /2026-11-08_baseline/);
  });

  it('rejects a folder without snapshot.json', () => {
    const dir = migrationsDir({ '20261108032219_baseline': ['migration.sql'] });
    const problems = folderProblems(dir, { mainFolders: null });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /20261108032219_baseline.*snapshot\.json/);
  });

  it('rejects two folders with the same timestamp', () => {
    const dir = migrationsDir({ '20261108032219_a': both, '20261108032219_b': both });
    const problems = folderProblems(dir, { mainFolders: null });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /20261108032219_b/);
  });

  it("rejects a branch folder older than main's newest", () => {
    const dir = migrationsDir({
      '20261108032219_baseline': both,
      '20261109090000_mine': both,
      '20261110000000_merged': both,
    });
    const main = ['20261108032219_baseline', '20261110000000_merged'];
    const problems = folderProblems(dir, { mainFolders: main });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /20261109090000_mine.*20261110000000_merged/);
  });
});

describe('migrations check', () => {
  let root;

  before(() => {
    // Temp copy of packages/db. Only drizzle-kit and drizzle-orm are linked, by their real paths:
    // pnpm's relative symlinks break behind a junction to the whole node_modules on Windows.
    root = mkdtempSync(join(tmpdir(), 'drift-db-'));
    const db = join(root, 'packages', 'db');
    mkdirSync(join(db, 'node_modules'), { recursive: true });
    for (const entry of ['drizzle.config.ts', 'package.json', 'src', 'migrations']) {
      cpSync(join(realDb, entry), join(db, entry), { recursive: true });
    }
    for (const pkg of ['drizzle-kit', 'drizzle-orm']) {
      const target = realpathSync(join(realDb, 'node_modules', pkg));
      symlinkSync(target, join(db, 'node_modules', pkg), 'junction');
    }
  });

  after(() => rmSync(root, { recursive: true, force: true }));

  it('is clean for the current repository', async () => {
    const check = migrationsCheck({ dbDir: 'packages/db' });
    const { code, results } = await runDrift({ root: repo, checks: [check], logDir: root });
    assert.equal(code, 0, JSON.stringify(results));
  });

  it('reports drift when a schema column is added without a migration', async () => {
    writeFileSync(
      join(root, 'packages', 'db', 'src', 'schema', 'index.ts'),
      [
        "import { pgTable, text } from 'drizzle-orm/pg-core';",
        "export const probe = pgTable('drift_probe', { id: text('id').primaryKey() });",
      ].join('\n'),
    );
    const check = migrationsCheck({ dbDir: 'packages/db', mainFolders: null });
    const { code, results } = await runDrift({ root, checks: [check], logDir: root });
    assert.equal(code, 1, JSON.stringify(results));
    assert.equal(results[0].status, 'drift');
    assert.equal(results[0].missing.length > 0, true);
    assert.match(results[0].hint, /\/db-migration/);
  });
});
