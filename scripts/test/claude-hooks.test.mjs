import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkBash,
  checkEdit,
  codeChanges,
  isSecretPath,
  toRepoPath,
} from '../../.claude/hooks/lib/policy.mjs';

const fresh = { tracked: false, lockedTests: [] };
const tracked = { tracked: true, lockedTests: [] };

describe('toRepoPath', () => {
  it('strips the project root on Windows and POSIX, case-insensitively', () => {
    assert.equal(toRepoPath('D:\\shifa\\apps\\api\\x.ts', 'D:\\shifa'), 'apps/api/x.ts');
    assert.equal(toRepoPath('d:/Shifa/apps/x.ts', 'D:\\shifa\\'), 'apps/x.ts');
    assert.equal(toRepoPath('/home/u/shifa/a.ts', '/home/u/shifa'), 'a.ts');
  });

  it('leaves paths outside the project unchanged', () => {
    assert.equal(toRepoPath('/tmp/other.ts', '/home/u/shifa'), '/tmp/other.ts');
  });
});

describe('isSecretPath', () => {
  for (const p of [
    '.env',
    '.env.local',
    'apps/api/.env.production',
    'certs/server.pem',
    'tls/x.KEY',
    'secrets/db.txt',
    'ops/dumps/2026.sql',
    'data-exports/patients.csv',
    'backup.sql.gz',
  ]) {
    it(`flags ${p}`, () => assert.equal(isSecretPath(p), true));
  }
  for (const p of [
    '.env.example',
    'apps/api/.env.example',
    'src/environment.ts',
    'keys.ts',
    'docs/secrets-policy.md',
  ]) {
    it(`allows ${p}`, () => assert.equal(isSecretPath(p), false));
  }
});

describe('checkEdit', () => {
  it('allows ordinary source and new files', () => {
    assert.equal(checkEdit('packages/testing/src/clock.ts', tracked), null);
    assert.equal(checkEdit('docs/adr/0027-new-decision.md', fresh), null);
    assert.equal(checkEdit('packages/db/migrations/0002_add.sql', fresh), null);
  });

  it('blocks secrets, generated files and the lockfile', () => {
    assert.match(checkEdit('.env', fresh), /secrets/);
    assert.match(checkEdit('packages/api-client-ts/src/index.ts', tracked), /generated/);
    assert.match(checkEdit('packages/x/src/generated/types.ts', fresh), /generated/);
    assert.match(checkEdit('packages/x/src/api.generated.ts', fresh), /generated/);
    assert.match(checkEdit('pnpm-lock.yaml', tracked), /generated/);
  });

  it('blocks the research archive and accepted ADRs', () => {
    assert.match(checkEdit('docs/research/archive/x/y.md', fresh), /read-only/);
    assert.match(checkEdit('docs/adr/0004-postgresql-pooled-tenancy-rls.md', tracked), /ADR/);
    assert.equal(checkEdit('docs/adr/README.md', tracked), null);
  });

  it('blocks committed migrations but not new ones', () => {
    assert.match(checkEdit('packages/db/migrations/0001_init.sql', tracked), /migration/);
    assert.equal(checkEdit('packages/db/migrations/0001_init.sql', fresh), null);
  });

  it('blocks locked tests only', () => {
    const ctx = { tracked: true, lockedTests: ['packages/x/test/a.test.ts'] };
    assert.match(checkEdit('packages/x/test/a.test.ts', ctx), /locked/);
    assert.equal(checkEdit('packages/x/test/b.test.ts', ctx), null);
  });
});

describe('checkBash', () => {
  const blocked = [
    'echo x > packages/testing/src/a.ts',
    'cat <<EOF >> scripts/verify.mjs',
    'printf x | tee apps/api/src/x.ts',
    "sed -i 's/a/b/' packages/testing/src/clock.ts",
    "perl -pi -e 's/a/b/' tooling/eslint-config/index.js",
    'Set-Content -Path packages/x/a.ts -Value 1',
    'echo hi > ./.claude/settings.json',
    'cat .env',
    'cat apps/api/.env.local',
    'Get-Content .env',
    'head -n 3 certs/server.pem',
    'git commit --no-verify -m x',
    'git push --force origin feature',
    'git push -f',
    'git push origin +feature',
    'git push origin main',
    'git push origin HEAD:main',
    'claude --dangerously-skip-permissions',
  ];
  for (const cmd of blocked) {
    it(`blocks: ${cmd}`, () => assert.notEqual(checkBash(cmd), null));
  }

  const allowed = [
    'pnpm verify',
    'git push -u origin chore/0.2-03-claude-code-setup',
    'git status --short',
    'node scripts/verify.mjs full > /dev/null 2>&1',
    'echo done > /tmp/out.txt',
    'cat .env.example',
    'cat packages/testing/src/clock.ts',
    'git log --oneline main',
    "grep -rn 'mainly' docs",
    'ls 2>&1',
  ];
  for (const cmd of allowed) {
    it(`allows: ${cmd}`, () => assert.equal(checkBash(cmd), null));
  }
});

describe('codeChanges', () => {
  it('ignores docs and markdown, keeps code and renames by their new path', () => {
    const porcelain = [
      ' M docs/roadmap.md',
      '?? CLAUDE.md',
      ' M scripts/verify.mjs',
      'R  old.ts -> packages/x/new.ts',
      '?? "packages/x/a b.ts"',
    ].join('\n');
    assert.deepEqual(codeChanges(porcelain), [
      'scripts/verify.mjs',
      'packages/x/new.ts',
      'packages/x/a b.ts',
    ]);
  });
});
