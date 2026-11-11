// Spec 0.2-09c criterion 9: the weekly drill workflow runs on a schedule and by hand only, with
// read-only permissions, no repository secrets, masked per-run secrets and the report uploaded.
// Pinning of actions to SHAs is checked for every workflow by zizmor in ci.yml (0.2-02).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const text = readFileSync(
  join(import.meta.dirname, '..', '..', '.github', 'workflows', 'backup-drill.yml'),
  'utf8',
);
const workflow = parse(text);
const steps = workflow.jobs.drill.steps;
const index = (pattern) => steps.findIndex((s) => pattern.test(String(s.run ?? s.uses ?? '')));

describe('backup drill workflow', () => {
  it('runs weekly and on manual dispatch only (never on pull requests)', () => {
    assert.deepEqual(Object.keys(workflow.on).sort(), ['schedule', 'workflow_dispatch']);
    assert.equal(workflow.on.schedule.length, 1);
  });

  it('has read-only permissions and never reads repository secrets', () => {
    assert.deepEqual(workflow.permissions, {});
    assert.deepEqual(workflow.jobs.drill.permissions, { contents: 'read' });
    assert.doesNotMatch(text, /\$\{\{[^}]*secrets\./);
    assert.equal(steps[0].with['persist-credentials'], false);
  });

  it('masks every generated secret before the drill runs', () => {
    const mask = index(/::add-mask::/);
    const drill = index(/^pnpm backup:drill$/);
    assert.ok(mask >= 0 && drill > mask, 'mask step must come before the drill');
    for (const name of [
      'BACKUP_POSTGRES_PASSWORD',
      'BACKUP_CIPHER_PASS',
      'BACKUP_GARAGE_RPC_SECRET',
      'BACKUP_GARAGE_ADMIN_TOKEN',
    ]) {
      assert.ok(steps[mask].run.includes(name), `${name} not generated`);
    }
  });

  it('runs the three fault self-tests as separate steps after the drill', () => {
    const drill = index(/^pnpm backup:drill$/);
    for (const fault of ['wrong-passphrase', 'missing-wal', 'garage-down']) {
      const at = index(new RegExp(`--self-test ${fault}$`));
      assert.ok(at > drill, `${fault} self-test missing or before the drill`);
    }
  });

  it('uploads the report even when a step failed, kept 90 days', () => {
    const upload = steps.find((s) => String(s.uses ?? '').startsWith('actions/upload-artifact@'));
    assert.ok(upload, 'no upload step');
    assert.equal(upload.if, 'always()');
    assert.equal(upload.with.path, '.verify/backup-drill/');
    assert.equal(upload.with['retention-days'], 90);
  });

  it('pins every action to a full commit SHA', () => {
    for (const step of steps.filter((s) => s.uses)) {
      assert.match(step.uses, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/, step.uses);
    }
  });
});
