import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { resolveFlutterRoot, toolPath } from '../lib/flutter-sdk.mjs';

const root = join('/repo');
const fvmSdk = join(root, '.fvm', 'flutter_sdk');
const has =
  (...paths) =>
  (p) =>
    paths.includes(p);

describe('resolveFlutterRoot', () => {
  it('prefers SHIFA_FLUTTER_ROOT (CI) over the FVM link', () => {
    const ci = join('/opt', 'flutter');
    const exists = has(join(ci, 'bin'), join(fvmSdk, 'bin'));
    assert.equal(resolveFlutterRoot({ env: { SHIFA_FLUTTER_ROOT: ci }, root, exists }), ci);
  });

  it('uses the FVM link when no override is set', () => {
    const exists = has(join(fvmSdk, 'bin'));
    assert.equal(resolveFlutterRoot({ env: {}, root, exists }), fvmSdk);
  });

  it('never falls back to a global Flutter on PATH', () => {
    const env = { PATH: join('/c', 'flutter', 'bin') };
    assert.throws(() => resolveFlutterRoot({ env, root, exists: () => false }), /fvm install/);
  });

  it('rejects an override that does not point at an SDK', () => {
    const env = { SHIFA_FLUTTER_ROOT: join('/nowhere') };
    assert.throws(
      () => resolveFlutterRoot({ env, root, exists: has(join(fvmSdk, 'bin')) }),
      /SHIFA_FLUTTER_ROOT/,
    );
  });
});

describe('toolPath', () => {
  it('uses the .bat shims on Windows only', () => {
    const sdk = join('/sdk');
    assert.equal(toolPath(sdk, 'dart', 'win32'), join(sdk, 'bin', 'dart.bat'));
    assert.equal(toolPath(sdk, 'flutter', 'win32'), join(sdk, 'bin', 'flutter.bat'));
    assert.equal(toolPath(sdk, 'dart', 'linux'), join(sdk, 'bin', 'dart'));
  });

  it('refuses unknown tools', () => {
    assert.throws(() => toolPath(join('/sdk'), 'pub', 'linux'), /dart or flutter/);
  });
});
