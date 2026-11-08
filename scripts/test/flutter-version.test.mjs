import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { readPinnedVersion, resolveFlutterRoot } from '../lib/flutter-sdk.mjs';

const root = join('/repo');
const fvmSdk = join(root, '.fvm', 'flutter_sdk');
const exists = (p) => p === join(fvmSdk, 'bin');

describe('resolveFlutterRoot version pin', () => {
  it('accepts an SDK of the pinned version', () => {
    const sdk = resolveFlutterRoot({
      env: {},
      root,
      exists,
      expected: '3.47.9',
      readVersion: () => '3.47.9',
    });
    assert.equal(sdk, fvmSdk);
  });

  it('refuses a stale FVM link after the pin moved', () => {
    assert.throws(
      () =>
        resolveFlutterRoot({
          env: {},
          root,
          exists,
          expected: '3.50.0',
          readVersion: () => '3.47.9',
        }),
      /pins 3\.50\.0.*fvm use/s,
    );
  });

  it('refuses an SDK whose version cannot be read', () => {
    assert.throws(
      () =>
        resolveFlutterRoot({ env: {}, root, exists, expected: '3.47.9', readVersion: () => null }),
      /unknown version/,
    );
  });
});

describe('readPinnedVersion', () => {
  it('reads .fvmrc and returns null when it is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fvmrc-'));
    try {
      assert.equal(readPinnedVersion(dir), null);
      writeFileSync(join(dir, '.fvmrc'), '{"flutter": "3.47.9"}');
      assert.equal(readPinnedVersion(dir), '3.47.9');
      writeFileSync(join(dir, '.fvmrc'), '{"flutter": "3.47.9", "flutterUrl": "https://x"}');
      assert.throws(() => readPinnedVersion(dir), /unexpected keys: flutterUrl/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
