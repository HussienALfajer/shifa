// Spec 0.2-09b criterion 8: `pnpm obs:*` generates the stack's secrets once, never prints them,
// passes them to children only through the environment, and refuses destructive or unready runs.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  BOOTSTRAP_KEYS,
  BOOTSTRAP_MARKER,
  ENV_PATH,
  obs,
  parseEnv,
  SECRET_KEYS,
} from '../lib/obs.mjs';

const ROOT = join('/', 'repo');
const ENV_FILE = join(ROOT, ENV_PATH);
const FAKE_DSN = 'http://0123456789abcdef0123456789abcdef@127.0.0.1:8000/1';
const RUNNING =
  'collector\nlgtm\nglitchtip-web\nglitchtip-worker\nglitchtip-postgres\nglitchtip-valkey\n';

/** A fake world: files in a Map, every child process recorded and answered from `answers`. */
function world({ files = new Map(), running = RUNNING } = {}) {
  const calls = [];
  const lines = [];
  const io = {
    root: ROOT,
    out: (line) => lines.push(line),
    randomBytes,
    readFile: (path) => files.get(path),
    writeFile: (path, text, mode) => files.set(path, Object.assign(new String(text), { mode })),
    removeFile: (path) => files.delete(path),
    run: async (cmd, args, options = {}) => {
      calls.push({ cmd, args, options });
      if (args.includes('ps')) return { code: 0, stdout: running };
      if (args.includes('shell')) {
        return {
          code: 0,
          stdout: `noise\n${BOOTSTRAP_MARKER}${JSON.stringify({ dsn: FAKE_DSN })}\n`,
        };
      }
      return { code: 0, stdout: '' };
    },
  };
  return { io, files, calls, lines, env: () => parseEnv(String(files.get(ENV_FILE) ?? '')) };
}

describe('obs up', () => {
  it('writes every key on first run: distinct secrets of at least 32 random bytes', async () => {
    const w = world();
    assert.equal(await obs(['up'], w.io), 0);
    const env = w.env();
    for (const key of [...SECRET_KEYS, ...BOOTSTRAP_KEYS]) assert.ok(env[key], `missing ${key}`);
    const secrets = SECRET_KEYS.map((key) => env[key]);
    assert.equal(new Set(secrets).size, secrets.length, 'secrets are not distinct');
    for (const [i, secret] of secrets.entries()) {
      assert.match(secret, /^[0-9a-f]{64,}$/, `${SECRET_KEYS[i]} is not ≥ 32 random bytes in hex`);
    }
    assert.equal(env.GLITCHTIP_DSN, FAKE_DSN);
    assert.equal(w.files.get(ENV_FILE).mode, 0o600);
  });

  it('starts the stack and waits for health, then bootstraps GlitchTip once', async () => {
    const w = world();
    await obs(['up'], w.io);
    const up = w.calls.find((c) => c.args.includes('up'));
    assert.ok(up, 'no compose up');
    assert.equal(up.cmd, 'docker');
    for (const flag of ['compose', '-d', '--wait']) assert.ok(up.args.includes(flag), flag);
    assert.equal(w.calls.filter((c) => c.args.includes('shell')).length, 1);

    const again = world({ files: w.files });
    await obs(['up'], again.io);
    assert.equal(
      again.calls.filter((c) => c.args.includes('shell')).length,
      0,
      'bootstrapped twice',
    );
  });

  it('keeps an existing .env: a second run changes no value', async () => {
    const w = world();
    await obs(['up'], w.io);
    const first = w.env();
    await obs(['up'], world({ files: w.files }).io);
    assert.deepEqual(w.env(), first);
  });

  it('never prints a secret or passes one as an argument; prints the two URLs', async () => {
    const w = world();
    await obs(['up'], w.io);
    const env = w.env();
    const printed = w.lines.join('\n');
    const argv = w.calls.map((c) => c.args.join(' ')).join('\n');
    for (const key of [...SECRET_KEYS, ...BOOTSTRAP_KEYS]) {
      assert.ok(!printed.includes(env[key]), `${key} printed`);
      assert.ok(!argv.includes(env[key]), `${key} in a command line`);
    }
    assert.ok(!printed.includes('0123456789abcdef'), 'the DSN key printed');
    assert.match(printed, /http:\/\/127\.0\.0\.1:3300/);
    assert.match(printed, /http:\/\/127\.0\.0\.1:8000/);
  });

  it('fails without writing the DSN when the bootstrap prints no result', async () => {
    const w = world();
    const run = w.io.run;
    w.io.run = async (cmd, args, options) =>
      args.includes('shell') ? { code: 1, stdout: '' } : run(cmd, args, options);
    assert.equal(await obs(['up'], w.io), 1);
    assert.equal(w.env().GLITCHTIP_DSN, undefined);
  });
});

describe('obs down and reset', () => {
  it('down stops the stack and keeps the volumes', async () => {
    const w = world();
    assert.equal(await obs(['down'], w.io), 0);
    const [call] = w.calls;
    assert.ok(call.args.includes('down'));
    assert.ok(!call.args.includes('-v') && !call.args.includes('--volumes'));
  });

  it('reset without --yes runs nothing and keeps the .env', async () => {
    const files = new Map([[ENV_FILE, 'GLITCHTIP_SECRET_KEY=x\n']]);
    const w = world({ files });
    assert.equal(await obs(['reset'], w.io), 1);
    assert.equal(w.calls.length, 0);
    assert.ok(files.has(ENV_FILE));
  });

  it('reset --yes removes the volumes and the .env', async () => {
    const files = new Map([[ENV_FILE, 'GLITCHTIP_SECRET_KEY=x\n']]);
    const w = world({ files });
    assert.equal(await obs(['reset', '--yes'], w.io), 0);
    assert.ok(w.calls.some((c) => c.args.includes('down') && c.args.includes('-v')));
    assert.ok(!files.has(ENV_FILE));
  });
});

describe('obs smoke', () => {
  it('refuses without a .env and runs nothing', async () => {
    const w = world();
    assert.equal(await obs(['smoke'], w.io), 1);
    assert.equal(w.calls.length, 0);
  });

  it('refuses when the stack is not running and never starts the API check', async () => {
    const w = world({ running: 'glitchtip-postgres\n' });
    await obs(['up'], w.io);
    const s = world({ files: w.files, running: 'glitchtip-postgres\n' });
    assert.equal(await obs(['smoke'], s.io), 1);
    assert.ok(!s.calls.some((c) => c.cmd === 'pnpm'));
  });

  it('builds the API and runs obs-smoke with the DSN in the child environment only', async () => {
    const w = world();
    await obs(['up'], w.io);
    const s = world({ files: w.files });
    assert.equal(await obs(['smoke'], s.io), 0);
    const pnpm = s.calls.filter((c) => c.cmd === 'pnpm').map((c) => c.args.join(' '));
    assert.deepEqual(pnpm, ['--filter @shifa/api build', '--filter @shifa/api obs-smoke']);
    const smoke = s.calls.at(-1);
    assert.equal(smoke.options.env.OBS_SENTRY_DSN, FAKE_DSN);
    assert.ok(smoke.options.env.OBS_GLITCHTIP_TOKEN);
    assert.ok(!s.lines.join('\n').includes(FAKE_DSN));
  });
});

describe('obs command line', () => {
  it('passes every child an argument array of strings and a bare program name', async () => {
    const w = world();
    await obs(['up'], w.io);
    await obs(['smoke'], w.io);
    await obs(['down'], w.io);
    await obs(['reset', '--yes'], w.io);
    assert.ok(w.calls.length > 0);
    for (const call of w.calls) {
      assert.ok(['docker', 'pnpm'].includes(call.cmd), call.cmd);
      assert.ok(Array.isArray(call.args));
      for (const arg of call.args) assert.equal(typeof arg, 'string');
      assert.equal(call.options.shell, undefined, 'no shell');
    }
  });

  it('exits 2 on an unknown or missing command and runs nothing', async () => {
    for (const argv of [['launch'], []]) {
      const w = world();
      assert.equal(await obs(argv, w.io), 2);
      assert.equal(w.calls.length, 0);
    }
  });
});
