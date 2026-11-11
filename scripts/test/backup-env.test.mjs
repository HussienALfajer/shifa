// Spec 0.2-09c criterion 1: `pnpm backup:up|down|reset` generate the stack's secrets once, never
// print them, pass them only through environments, and bootstrap Garage with a key limited to
// the one bucket.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { backupCommand } from '../lib/backup.mjs';
import { BUCKET, CA_PATH, GARAGE_KEYS, SECRET_KEYS } from '../lib/backup-env.mjs';
import { parseGarageKey } from '../lib/backup-stack.mjs';
import { ENV_FILE, FULL_ENV, has, ROOT, world } from './helpers/backup-world.mjs';

const KEY_SECRET = 'f'.repeat(64);
const KEY_OUTPUT = `==== ACCESS KEY INFORMATION ====\nKey ID:              GK0e9d01bea18c5587e77c6561\nKey name:            shifa-pgbackrest\nSecret key:          ${KEY_SECRET}\n`;

/** Answers like a fresh Garage, Caddy and PostgreSQL. */
function freshStack(cmd, args) {
  if (has(args, '/garage', 'status')) return { stdout: 'ID  Hostname  NO ROLE ASSIGNED\n' };
  if (has(args, 'node', 'id', '-q')) return { stdout: `${'9'.repeat(64)}@127.0.0.1:3901\n` };
  if (has(args, 'bucket', 'info')) return { code: 1 };
  if (has(args, 'key', 'info')) return { code: 1 };
  if (has(args, 'key', 'create')) return { stdout: KEY_OUTPUT };
  if (args.includes('cat'))
    return { stdout: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n' };
  return undefined;
}

describe('backup up', () => {
  it('writes every key on first run: distinct secrets of at least 32 random bytes, mode 0600', async () => {
    const w = world({ answer: freshStack });
    assert.equal(await backupCommand(['up'], w.io), 0);
    const env = w.env();
    for (const key of [...SECRET_KEYS, ...GARAGE_KEYS]) assert.ok(env[key], `missing ${key}`);
    const secrets = SECRET_KEYS.map((key) => env[key]);
    assert.equal(new Set(secrets).size, secrets.length, 'secrets are not distinct');
    for (const secret of secrets) assert.match(secret, /^[0-9a-f]{64,}$/);
    assert.equal(env.BACKUP_S3_KEY_SECRET, KEY_SECRET);
    assert.equal(w.files.get(ENV_FILE).mode, 0o600);
    assert.match(String(w.files.get(join(ROOT, CA_PATH))), /BEGIN CERTIFICATE/);
  });

  it('keeps an existing .env and skips the Garage bootstrap', async () => {
    const w = world({ env: FULL_ENV, answer: freshStack });
    assert.equal(await backupCommand(['up'], w.io), 0);
    assert.deepEqual(w.env(), FULL_ENV);
    assert.ok(!w.calls.some((c) => has(c.args, 'key', 'create')), 'bootstrapped again');
  });

  it('uses secrets already in the environment (CI masks them first)', async () => {
    const processEnv = { BACKUP_CIPHER_PASS: '1'.repeat(64) };
    const w = world({ answer: freshStack, processEnv });
    assert.equal(await backupCommand(['up'], w.io), 0);
    assert.equal(w.env().BACKUP_CIPHER_PASS, processEnv.BACKUP_CIPHER_PASS);
  });

  it('allows the key to read and write the one bucket only, never as owner', async () => {
    const w = world({ answer: freshStack });
    await backupCommand(['up'], w.io);
    const allows = w.calls.filter((c) => has(c.args, 'bucket', 'allow'));
    assert.equal(allows.length, 1);
    const args = allows[0].args;
    assert.ok(has(args, '--read', '--write', BUCKET, '--key', 'GK0e9d01bea18c5587e77c6561'));
    assert.ok(!args.includes('--owner'));
    assert.ok(!w.calls.some((c) => has(c.args, 'key', 'allow')), 'no --create-bucket grant');
  });

  it('never prints a secret and never puts one in an argument', async () => {
    const w = world({ answer: freshStack });
    await backupCommand(['up'], w.io);
    const env = w.env();
    for (const key of [...SECRET_KEYS, 'BACKUP_S3_KEY_SECRET']) {
      assert.ok(!w.output().includes(env[key]), `${key} printed`);
      for (const call of w.calls) assert.ok(!call.args.includes(env[key]), `${key} in argv`);
    }
  });

  it('runs every child from an argument array (no shell strings)', async () => {
    const w = world({ answer: freshStack });
    await backupCommand(['up'], w.io);
    for (const call of w.calls) {
      assert.ok(Array.isArray(call.args), `${call.cmd} without an argument array`);
      assert.notEqual(call.options.shell, true);
    }
  });

  it('starts Garage before the bucket key exists, then the whole stack, then the stanza', async () => {
    const w = world({ answer: freshStack });
    await backupCommand(['up'], w.io);
    const order = w.calls
      .map((c) =>
        has(c.args, 'up', '-d', '--wait', 'garage', 'garage-tls')
          ? 'garage'
          : has(c.args, 'key', 'create')
            ? 'key'
            : has(c.args, 'up', '-d', '--wait', '--build')
              ? 'stack'
              : c.args.includes('stanza-create')
                ? 'stanza'
                : undefined,
      )
      .filter(Boolean);
    assert.deepEqual(order, ['garage', 'key', 'stack', 'stanza']);
    const first = w.calls.find((c) => has(c.args, 'garage', 'garage-tls'));
    assert.equal(first.options.env.BACKUP_S3_KEY_ID, 'unused', 'placeholder before the bootstrap');
  });

  it('fails when the Garage bootstrap fails', async () => {
    const w = world({
      answer: (cmd, args) => (has(args, '/garage', 'status') ? { code: 1 } : freshStack(cmd, args)),
    });
    assert.equal(await backupCommand(['up'], w.io), 1);
    assert.match(w.output(), /Garage bootstrap failed at status/);
  });
});

describe('backup down and reset', () => {
  it('reset without --yes runs nothing', async () => {
    const w = world({ env: FULL_ENV });
    assert.equal(await backupCommand(['reset'], w.io), 1);
    assert.equal(w.calls.length, 0);
    assert.ok(w.files.has(ENV_FILE));
  });

  it('reset --yes removes volumes, restores and the .env', async () => {
    const w = world({ env: FULL_ENV });
    assert.equal(await backupCommand(['reset', '--yes'], w.io), 0);
    assert.ok(w.calls.some((c) => has(c.args, 'down', '-v')));
    assert.ok(w.calls.some((c) => c.args.includes('label=shifa.backup.restore')));
    assert.ok(!w.files.has(ENV_FILE));
  });

  it('down and reset work without a .env', async () => {
    const w = world();
    assert.equal(await backupCommand(['down'], w.io), 0);
    assert.ok(!w.calls[0].args.includes('--env-file'));
  });
});

describe('backup command line', () => {
  it('exits 2 with the usage for an unknown command', async () => {
    const w = world();
    assert.equal(await backupCommand(['restart'], w.io), 2);
    assert.match(w.output(), /^usage: pnpm backup:up/);
  });

  it('parses Garage key output and rejects a partial one', () => {
    assert.deepEqual(parseGarageKey(KEY_OUTPUT), {
      id: 'GK0e9d01bea18c5587e77c6561',
      secret: KEY_SECRET,
    });
    assert.equal(parseGarageKey('Key ID: GK01\n'), undefined);
  });
});
