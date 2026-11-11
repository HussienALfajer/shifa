import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const script = join(import.meta.dirname, '..', 'env-check.mjs');

describe('env-check CLI', () => {
  it('prints one line per expected item and exits 0 or 1 without crashing', () => {
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 90_000 });
    assert.equal(result.error, undefined, String(result.error));
    assert.ok(
      result.status === 0 || result.status === 1,
      `exit ${result.status}\n${result.stdout}\n${result.stderr}`,
    );
    const items = ['node', 'pnpm', 'flutter', 'docker', 'git autocrlf', 'line endings'];
    if (process.platform === 'win32') items.push('sandbox');
    if (process.platform === 'linux') items.push('repo location', 'bwrap', 'socat');
    const lines = result.stdout.split('\n');
    for (const item of items) {
      assert.ok(
        lines.some((l) => l.startsWith(`${item} `)),
        `missing ${item} in:\n${result.stdout}`,
      );
    }
    const fails = lines.filter((l) => /\sfail\s/.test(l)).length;
    assert.equal(result.status, fails > 0 ? 1 : 0, result.stdout);
  });
});
