import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { readPinnedVersion, resolveFlutterRoot } from '../lib/flutter-sdk.mjs';

const repoRoot = join(import.meta.dirname, '..', '..');
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

describe('workflow Flutter pins', () => {
  it('every workflow installs the Flutter version of .fvmrc with one archive hash', () => {
    const pinned = readPinnedVersion(repoRoot);
    const dir = join(repoRoot, '.github', 'workflows');
    const pins = readdirSync(dir)
      .filter((name) => name.endsWith('.yml'))
      .map((name) => {
        const text = readFileSync(join(dir, name), 'utf8');
        return {
          name,
          version: /^\s*FLUTTER_VERSION:\s*(\S+)/m.exec(text)?.[1],
          sha: /^\s*FLUTTER_SHA256:\s*(\S+)/m.exec(text)?.[1],
        };
      })
      .filter((pin) => pin.version !== undefined);
    assert.ok(
      pins.some((pin) => pin.name === 'ci.yml'),
      'ci.yml pins FLUTTER_VERSION',
    );
    for (const pin of pins) {
      assert.equal(pin.version, pinned, `${pin.name} installs Flutter ${pin.version}`);
      assert.match(pin.sha ?? '', /^[0-9a-f]{64}$/, `${pin.name} has a FLUTTER_SHA256`);
    }
    assert.equal(
      new Set(pins.map((pin) => pin.sha)).size,
      1,
      'one FLUTTER_SHA256 for all workflows',
    );
  });
});
