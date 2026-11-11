import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, '..', '..');
const read = (...p) => readFileSync(join(root, ...p), 'utf8');
const settings = JSON.parse(read('.claude', 'settings.json'));

describe('.claude/settings.json sandbox', () => {
  it('keeps the sandbox enabled', () => {
    assert.equal(settings.sandbox?.enabled, true);
  });

  it('allows exact hostnames only (no wildcard, scheme, path, port or IP)', () => {
    const domains = settings.sandbox?.network?.allowedDomains ?? [];
    assert.ok(domains.length > 0, 'allowlist is empty');
    for (const d of domains) {
      assert.match(d, /^(?=.*[a-z])[a-z0-9-]+(\.[a-z0-9-]+)+$/, `not an exact hostname: ${d}`);
      assert.doesNotMatch(d, /^\d+(\.\d+){3}$/, `IP address: ${d}`);
    }
  });

  it('has no excluded commands', () => {
    assert.equal(settings.sandbox?.excludedCommands, undefined);
  });
});

describe('WSL2 setup docs', () => {
  const guide = read('docs', 'process', 'wsl2-setup.md');

  it('names the required steps', () => {
    for (const term of ['Ubuntu-26.04', 'bubblewrap', 'socat', 'core.autocrlf', '~/src/shifa']) {
      assert.ok(guide.includes(term), `guide does not mention ${term}`);
    }
  });

  it('is linked from docs/README.md and the root CLAUDE.md', () => {
    assert.match(read('docs', 'README.md'), /process\/wsl2-setup\.md/);
    assert.match(read('CLAUDE.md'), /docs\/process\/wsl2-setup\.md/);
  });
});
