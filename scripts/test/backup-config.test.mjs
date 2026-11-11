// Spec 0.2-09c criteria 2 and 3: the pgBackRest configuration (S3 on Garage over verified TLS,
// AES-256 encryption, zstd, time-based retention) and the schedule commands.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { backupCommand } from '../lib/backup.mjs';
import { FULL_ENV, has, world } from './helpers/backup-world.mjs';

const dir = join(import.meta.dirname, '..', '..', 'infra', 'backup');
const conf = readFileSync(join(dir, 'pgbackrest', 'pgbackrest.conf'), 'utf8');
const schedule = JSON.parse(readFileSync(join(dir, 'schedule.json'), 'utf8'));
const garage = readFileSync(join(dir, 'garage', 'garage.toml'), 'utf8');

/** Active `key=value` lines (comments dropped). */
const settings = Object.fromEntries(
  conf
    .split(/\r?\n/)
    .filter((l) => /^[a-z0-9-]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

describe('pgBackRest configuration', () => {
  it('stores repo1 on Garage through S3 with path-style URIs and a verified CA', () => {
    assert.equal(settings['repo1-type'], 's3');
    assert.equal(settings['repo1-s3-uri-style'], 'path');
    assert.equal(settings['repo1-s3-bucket'], 'shifa-backup');
    assert.ok(settings['repo1-storage-ca-file'], 'no CA file');
    assert.doesNotMatch(conf, /verify-tls\s*=\s*n/);
  });

  it('encrypts with AES-256 and compresses with zstd', () => {
    assert.equal(settings['repo1-cipher-type'], 'aes-256-cbc');
    assert.equal(settings['compress-type'], 'zst');
  });

  it('keeps full backups 30 days by time, as schedule.json says', () => {
    assert.equal(settings['repo1-retention-full-type'], 'time');
    assert.equal(Number(settings['repo1-retention-full']), schedule.retentionDays);
    assert.equal(schedule.retentionDays, 30);
  });

  it('logs at info (no SQL) and holds no secret', () => {
    assert.equal(settings['log-level-console'], 'info');
    assert.equal(settings['log-level-file'], 'info');
    for (const key of ['repo1-s3-key', 'repo1-s3-key-secret', 'repo1-cipher-pass']) {
      assert.equal(settings[key], undefined, `${key} must come from the environment`);
    }
    assert.doesNotMatch(conf, /[0-9a-f]{32}/);
    assert.doesNotMatch(garage, /^\s*(rpc_secret|admin_token|metrics_token)\s*=/m);
  });

  it('marks the off-site repo2 as commented out (OD-01)', () => {
    assert.match(conf, /^# repo2-type=s3$/m);
    assert.equal(settings['repo2-type'], undefined);
  });
});

describe('schedule', () => {
  it('runs full weekly, differential on the other days, WAL every minute at most', () => {
    assert.equal(schedule.full.cron, '0 2 * * 0');
    assert.equal(schedule.diff.cron, '0 2 * * 1-6');
    assert.equal(schedule.full.command, 'pnpm backup:full');
    assert.equal(schedule.diff.command, 'pnpm backup:diff');
    assert.equal(schedule.wal.archiveTimeoutSeconds, 60);
    assert.ok(schedule.maxBackupAgeHours > 24 && schedule.maxBackupAgeHours <= 48);
  });

  for (const type of ['full', 'diff']) {
    it(`backup:${type} runs pgbackrest --type=${type} backup in the source container`, async () => {
      const w = world({ env: FULL_ENV });
      assert.equal(await backupCommand([type], w.io), 0);
      assert.equal(w.calls.length, 1);
      const { cmd, args } = w.calls[0];
      assert.equal(cmd, 'docker');
      assert.ok(
        has(
          args,
          'exec',
          '-T',
          '-u',
          'postgres',
          'postgres',
          'pgbackrest',
          '--stanza=shifa',
          `--type=${type}`,
          'backup',
        ),
      );
      for (const value of Object.values(FULL_ENV)) assert.ok(!args.includes(value));
    });
  }

  it('refuses a backup before backup:up', async () => {
    const w = world();
    assert.equal(await backupCommand(['full'], w.io), 1);
    assert.equal(w.calls.length, 0);
  });
});
