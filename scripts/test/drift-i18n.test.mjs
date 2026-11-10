// The i18n drift check regenerates packages/i18n/generated with the real generator, against a
// temp copy of the locale source, so a stale ARB or keys file fails check-drift.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import config from '../drift.config.mjs';
import { runDrift } from '../lib/drift.mjs';
import { i18nCheck } from '../lib/drift-i18n.mjs';

const repo = join(import.meta.dirname, '..', '..');
const realPkg = join(repo, 'packages', 'i18n');
const generator = join(realPkg, 'scripts', 'generate.ts');

let root;
let pkg;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'drift-i18n-'));
  pkg = join(root, 'packages', 'i18n');
  cpSync(join(realPkg, 'src', 'locales'), join(pkg, 'src', 'locales'), { recursive: true });
  cpSync(join(realPkg, 'generated'), join(pkg, 'generated'), { recursive: true });
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const drift = () =>
  runDrift({ root, checks: [i18nCheck({ generator })], logDir: join(root, '.logs') });

function editCommon(change) {
  const file = join(pkg, 'src', 'locales', 'ar', 'common.json');
  writeFileSync(
    file,
    `${JSON.stringify(change(JSON.parse(readFileSync(file, 'utf8'))), null, 2)}\n`,
  );
}

describe('i18nCheck', () => {
  it('is registered after the API clients', () => {
    const names = config.map((c) => c.name);
    assert.ok(names.includes('i18n'));
    assert.ok(names.indexOf('i18n') > names.indexOf('api-client-ts'));
  });

  it('is clean for the committed source and generated files', async () => {
    const { code, results } = await drift();
    assert.equal(code, 0, JSON.stringify(results));
  });

  it('red: a changed message makes the ARB stale', async () => {
    editCommon((m) => ({ ...m, [Object.keys(m)[0]]: 'نص مختلف' }));
    const { code, results } = await drift();
    assert.equal(code, 1);
    assert.deepEqual(results[0].stale, ['packages/i18n/generated/arb/app_ar.arb']);
  });

  it('red: a new key makes the ARB and the keys file stale', async () => {
    editCommon((m) => ({ ...m, driftProbe: 'مفتاح جديد' }));
    const { code, results } = await drift();
    assert.equal(code, 1);
    assert.deepEqual(results[0].stale.sort(), [
      'packages/i18n/generated/arb/app_ar.arb',
      'packages/i18n/generated/keys.ts',
    ]);
  });

  it('red: a deleted keys file is missing', async () => {
    rmSync(join(pkg, 'generated', 'keys.ts'));
    const { code, results } = await drift();
    assert.equal(code, 1);
    assert.deepEqual(results[0].missing, ['packages/i18n/generated/keys.ts']);
  });
});
