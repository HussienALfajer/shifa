// The pinned Collector image accepts infra/observability/collector.yaml exactly as committed.
// obs-collector-run.test.mjs re-serialises the processors through the JS `yaml` library, which
// is more lenient than the Collector's Go parser (an unquoted RE2 pattern in a flow mapping
// parsed in JS and crash-looped the Collector). Needs Docker; skipped with a reason otherwise.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

const dir = join(import.meta.dirname, '..', '..', 'infra', 'observability');

const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
  encoding: 'utf8',
  timeout: 20_000,
});
const skip = docker.status === 0 ? false : 'Docker is not reachable (runs in CI)';
if (skip) process.stdout.write(`obs-collector-validate: skipped: ${skip}\n`);

describe('Collector config on the pinned image', { skip }, () => {
  it('passes `validate` unmodified', () => {
    const image = parse(readFileSync(join(dir, 'compose.yml'), 'utf8')).services.collector.image;
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${join(dir, 'collector.yaml')}:/etc/shifa/collector.yaml:ro`,
        image,
        'validate',
        '--config=/etc/shifa/collector.yaml',
      ],
      { encoding: 'utf8', timeout: 120_000 },
    );
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  });
});
