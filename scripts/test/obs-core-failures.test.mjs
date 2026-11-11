// Failure paths of `pnpm obs:*` beyond obs-core.test.mjs (review of 0.2-09b3): a failed
// `compose up`, an incomplete .env, and stopping or wiping the stack after the .env was lost.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { ENV_PATH, obs, SECRET_KEYS } from '../lib/obs.mjs';

const ROOT = join('/', 'repo');
const ENV_FILE = join(ROOT, ENV_PATH);

function world({ files = new Map(), code = () => 0 } = {}) {
  const calls = [];
  const io = {
    root: ROOT,
    out: () => undefined,
    randomBytes,
    readFile: (path) => files.get(path),
    writeFile: (path, text) => files.set(path, String(text)),
    removeFile: (path) => files.delete(path),
    run: async (cmd, args, options = {}) => {
      calls.push({ cmd, args, options });
      return { code: code(args), stdout: '' };
    },
  };
  return { io, files, calls };
}

describe('obs failure paths', () => {
  it('up: a failed `compose up` returns 1 and never bootstraps GlitchTip', async () => {
    const w = world({ code: (args) => (args.includes('up') ? 1 : 0) });
    assert.equal(await obs(['up'], w.io), 1);
    assert.equal(w.calls.length, 1);
    assert.ok(!w.calls.some((c) => c.args.includes('shell')));
  });

  it('up: an existing .env without every secret returns 1 and runs nothing', async () => {
    const partial = `${SECRET_KEYS.slice(1)
      .map((key) => `${key}=${'a'.repeat(64)}`)
      .join('\n')}\n`;
    const w = world({ files: new Map([[ENV_FILE, partial]]) });
    assert.equal(await obs(['up'], w.io), 1);
    assert.equal(w.calls.length, 0);
    assert.equal(w.files.get(ENV_FILE), partial, 'the .env was rewritten');
  });

  it('down and reset --yes work without a .env: no --env-file, placeholders in the env', async () => {
    for (const argv of [['down'], ['reset', '--yes']]) {
      const w = world();
      assert.equal(await obs(argv, w.io), 0, argv.join(' '));
      const [call] = w.calls;
      assert.ok(!call.args.includes('--env-file'), `${argv.join(' ')}: --env-file`);
      for (const key of SECRET_KEYS) assert.equal(call.options.env?.[key], 'unused', key);
    }
  });
});
