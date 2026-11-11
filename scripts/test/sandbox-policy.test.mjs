// Sandbox policy gate (0.2-09a security review). Every PR auto-merges on green CI (ADR-0028), so
// this test is what stops a later PR from quietly widening the sandbox. Changing the allowlist or
// adding a key means editing this file, with the reason in the commit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const settings = JSON.parse(
  readFileSync(join(import.meta.dirname, '..', '..', '.claude', 'settings.json'), 'utf8'),
);
const sandbox = settings.sandbox ?? {};

/** Exact domains, each needed by a named tool. */
const ALLOWED_DOMAINS = [
  'api.github.com', // gh
  'github.com', // git, gh, fvm (Flutter SDK clone)
  'objects.githubusercontent.com', // gh release assets
  'pub.dev', // dart pub get
  'registry.npmjs.org', // pnpm install, pnpm view
  'storage.googleapis.com', // Flutter engine artifacts, pub package archives
];

const SANDBOX_KEYS = new Set([
  'enabled',
  'allowUnsandboxedCommands',
  'failIfUnavailable',
  'network',
  'filesystem',
  'credentials',
]);
const NETWORK_KEYS = new Set(['allowedDomains', 'deniedDomains']);
/** Keys that weaken isolation; each needs an owner decision and an edit here. */
const FORBIDDEN = [
  'excludedCommands',
  'ignoreViolations',
  'enableWeakerNestedSandbox',
  'enableWeakerNetworkIsolation',
  'network.allowAllUnixSockets',
  'network.allowUnixSockets',
  'network.allowLocalBinding',
  'network.httpProxyPort',
  'network.socksProxyPort',
  'filesystem.disabled',
];

describe('sandbox policy', () => {
  it('uses only known sandbox keys', () => {
    for (const key of Object.keys(sandbox)) assert.ok(SANDBOX_KEYS.has(key), `sandbox.${key}`);
    for (const key of Object.keys(sandbox.network ?? {})) {
      assert.ok(NETWORK_KEYS.has(key), `sandbox.network.${key}`);
    }
  });

  it('sets none of the weakening keys', () => {
    for (const path of FORBIDDEN) {
      const value = path.split('.').reduce((o, k) => o?.[k], sandbox);
      assert.equal(value, undefined, `sandbox.${path} is set`);
    }
  });

  it('ignores dangerouslyDisableSandbox retries (OD-24)', () => {
    assert.equal(sandbox.allowUnsandboxedCommands, false);
  });

  it('denies reads of credentials and Windows drives (OD-26)', () => {
    const denied = sandbox.filesystem?.denyRead ?? [];
    for (const path of ['~/.ssh', '~/.claude/.credentials.json', '//mnt/c', '//mnt/d']) {
      assert.ok(denied.includes(path), `denyRead lacks ${path}`);
    }
  });

  it('allows exactly the listed domains', () => {
    const actual = [...(sandbox.network?.allowedDomains ?? [])].sort();
    assert.deepEqual(actual, [...ALLOWED_DOMAINS].sort());
  });
});
