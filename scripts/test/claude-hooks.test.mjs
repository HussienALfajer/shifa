import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkBash,
  checkEdit,
  codeChanges,
  isStatusLineEdit,
  stripPayload,
  toRepoPath,
} from '../../.claude/hooks/lib/policy.mjs';

const branchOnly = { onMain: false, lockedTests: [] };
const merged = { onMain: true, lockedTests: [] };
const acceptedAdr = { onMain: true, acceptedOnMain: true, lockedTests: [] };

describe('toRepoPath', () => {
  it('strips the project root on Windows and POSIX, case-insensitively', () => {
    assert.equal(toRepoPath('D:\\shifa\\apps\\api\\x.ts', 'D:\\shifa'), 'apps/api/x.ts');
    assert.equal(toRepoPath('d:/Shifa/apps/x.ts', 'D:\\shifa\\'), 'apps/x.ts');
    assert.equal(toRepoPath('/home/u/shifa/a.ts', '/home/u/shifa'), 'a.ts');
  });

  it('resolves .. and a leading ./', () => {
    assert.equal(
      toRepoPath('D:\\shifa\\apps\\..\\docs\\adr\\0002-x.md', 'D:\\shifa'),
      'docs/adr/0002-x.md',
    );
    assert.equal(toRepoPath('./apps/web/a.test.ts', 'D:\\shifa'), 'apps/web/a.test.ts');
  });

  it('leaves paths outside the project unchanged', () => {
    assert.equal(toRepoPath('/tmp/other.ts', '/home/u/shifa'), '/tmp/other.ts');
  });
});

describe('secret files (ADR-0028: allowed)', () => {
  for (const p of ['.env', '.env.local', 'apps/api/.env.production', 'certs/server.pem']) {
    it(`allows editing ${p}`, () => assert.equal(checkEdit(p, branchOnly), null));
  }
});

describe('isStatusLineEdit', () => {
  it('accepts a change of the Status line only', () => {
    assert.equal(
      isStatusLineEdit('Status: Accepted · Date: 2026-11-08', 'Status: Superseded by ADR-0030'),
      true,
    );
  });
  it('rejects edits that touch more than the Status line', () => {
    assert.equal(isStatusLineEdit('Status: Accepted\n## Decision', 'Status: X\n## Changed'), false);
    assert.equal(isStatusLineEdit('## Decision', '## Changed'), false);
    assert.equal(isStatusLineEdit(undefined, 'Status: X'), false);
  });
});

describe('checkEdit', () => {
  it('allows ordinary source and new files', () => {
    assert.equal(checkEdit('packages/testing/src/clock.ts', merged), null);
    assert.equal(checkEdit('docs/adr/0027-new-decision.md', branchOnly), null);
    assert.equal(checkEdit('packages/db/migrations/0002_add.sql', branchOnly), null);
  });

  it('blocks generated files and the lockfile', () => {
    assert.match(checkEdit('packages/api-client-ts/src/index.ts', merged), /generated/);
    assert.match(checkEdit('packages/x/src/generated/types.ts', branchOnly), /generated/);
    assert.match(checkEdit('packages/x/src/api.generated.ts', branchOnly), /generated/);
    assert.match(checkEdit('pnpm-lock.yaml', merged), /generated/);
  });

  it('blocks generated Dart files but not hand-written ones', () => {
    assert.match(checkEdit('apps/patient_app/lib/foo.g.dart', branchOnly), /generated/);
    assert.match(checkEdit('apps/patient_app/lib/foo.freezed.dart', branchOnly), /generated/);
    assert.match(checkEdit('apps/patient_app/test/foo.mocks.dart', branchOnly), /generated/);
    assert.match(checkEdit('pubspec.lock', branchOnly), /generated/);
    assert.equal(checkEdit('packages/shifa_testing/lib/src/fixed_clock.dart', merged), null);
  });

  it('blocks the research archive in any casing', () => {
    assert.match(checkEdit('docs/research/archive/x/y.md', branchOnly), /read-only/);
    assert.match(checkEdit('Docs/Research/archive/x.md', branchOnly), /read-only/);
  });

  it('protects accepted ADRs but allows Status-line updates and proposed ADRs', () => {
    const adr = 'docs/adr/0004-postgresql-pooled-tenancy-rls.md';
    assert.match(checkEdit(adr, acceptedAdr), /accepted ADR/);
    assert.equal(checkEdit(adr, { ...acceptedAdr, statusLineOnly: true }), null);
    assert.equal(checkEdit('docs/adr/0014-offline-sync-engine.md', merged), null);
    assert.equal(checkEdit('docs/adr/README.md', acceptedAdr), null);
  });

  it('protects merged migrations but not ones still on the slice branch', () => {
    assert.match(checkEdit('packages/db/migrations/0001_init.sql', merged), /migration/);
    assert.equal(checkEdit('packages/db/migrations/0001_init.sql', branchOnly), null);
  });

  it('blocks locked tests only', () => {
    const ctx = { onMain: false, lockedTests: ['packages/x/test/a.test.ts'] };
    assert.match(checkEdit('packages/x/test/a.test.ts', ctx), /locked/);
    assert.equal(checkEdit('packages/x/test/b.test.ts', ctx), null);
  });
});

describe('stripPayload', () => {
  it('drops heredoc bodies but keeps the first line', () => {
    const cmd = "cat <<'EOF' > /tmp/x\nsee > apps/web\nEOF";
    assert.equal(stripPayload(cmd).includes('apps/web'), false);
    assert.match(stripPayload('cat <<EOF > packages/x.ts\nbody\nEOF'), /> packages\/x\.ts/);
  });

  it('empties message, body and title values', () => {
    assert.equal(stripPayload('git commit -m "move -> apps/web"'), 'git commit -m ""');
    assert.equal(
      stripPayload("gh pr create --body '> packages/db' --title 'x'"),
      'gh pr create --body "" --title ""',
    );
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
    // absolute and Windows-style paths
    'echo x > D:/shifa/apps/web/x.ts',
    'echo x > /d/shifa/apps/web/x.ts',
    'echo x > "$CLAUDE_PROJECT_DIR/apps/web/x.ts"',
    'Set-Content -Path apps\\web\\x.ts -Value 1',
    'Set-Content -Path D:\\shifa\\apps\\web\\x.ts -Value 1',
    '"x" | Out-File apps\\web\\x.ts',
    '"x" > apps\\web\\x.ts',
    'sc apps/web/x.ts 1',
    // git and permissions
    'git commit --no-verify -m x',
    'git push --force origin feature',
    'git push -f',
    'git push origin +feature',
    'git push origin main',
    'git push origin HEAD:main',
    'claude --dangerously-skip-permissions',
    'claude --permission-mode bypassPermissions',
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
    // secrets are readable (ADR-0028)
    'cat .env',
    'Get-Content apps/api/.env.local',
    'head -n 3 certs/server.pem',
    'cat packages/testing/src/clock.ts',
    'git log --oneline main',
    "grep -rn 'mainly' docs",
    'ls 2>&1',
    // payload text is not a command
    'git commit -m "refactor: move helpers -> apps/web"',
    'git commit -m "docs: explain --no-verify is refused"',
    "gh pr create --title 'x' --body '> packages/db changed'",
    "cat <<'EOF' > /tmp/notes.md\nwrites go > apps/web via Edit\nEOF",
    "sed -i 's/a/b/' docs/myapps/x.md",
    'grep -rn bypassPermissions .claude/',
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
