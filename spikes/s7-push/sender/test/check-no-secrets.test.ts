// Key-leak check (ADR-0026): each planted pattern fails, a clean tree passes, a tracked
// google-services.json fails. Every planted secret is assembled at run time in a temp directory,
// so this file itself holds none of the patterns it looks for.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkNoSecrets } from '../scripts/check-no-secrets.ts';
import { tempDir } from './helpers.ts';

const BEGIN = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
const PLANTS: Record<string, string> = {
  'private key block': `${BEGIN}\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n`,
  'service account object': `{ "${'type'}": "${'service'}_account", "project_id": "x" }`,
  'Firebase API key': `const k = "${'AI'}za${'A'.repeat(35)}";`,
  'google-services body': `{ "${'project'}_info": { "project_number": "1" } }`,
  'FCM token': `token=${'d'.repeat(22)}:${'APA'}91b${'Z'.repeat(140)}`,
};

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function repo(files: Record<string, string>) {
  const t = tempDir('s7-secrets-');
  cleanup = t.cleanup;
  for (const [path, content] of Object.entries(files)) {
    const full = join(t.dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return t.dir;
}

const CLEAN = {
  'spikes/s7-push/README.md': '# Push spike\nSynthetic data only.\n',
  'spikes/s7-push/sender/src/x.ts': 'export const label = "s7_reminder";\n',
};
const listed =
  (tracked: string[], untracked: string[] = []) =>
  () => ({ tracked, untracked });

describe('check-no-secrets', () => {
  it('passes on a clean tree', () => {
    const root = repo(CLEAN);
    expect(checkNoSecrets({ repoRoot: root, listFiles: listed(Object.keys(CLEAN)) })).toEqual([]);
  });

  for (const [name, content] of Object.entries(PLANTS)) {
    it(`fails on a planted ${name} (tracked, untracked, log or report)`, () => {
      const files = {
        ...CLEAN,
        'spikes/s7-push/sender/src/leak.ts': content,
        'spikes/s7-push/probe/lib/new.dart': content,
        'spikes/s7-push/.out/logs/sends.jsonl': content,
        'docs/spikes/s7-push.md': content,
        // Outside the spike: not this check's scope.
        'apps/web/src/other.ts': content,
      };
      const root = repo(files);
      const findings = checkNoSecrets({
        repoRoot: root,
        listFiles: listed(
          [...Object.keys(CLEAN), 'spikes/s7-push/sender/src/leak.ts', 'docs/spikes/s7-push.md'],
          ['spikes/s7-push/probe/lib/new.dart', 'apps/web/src/other.ts'],
        ),
      });
      expect(findings.map((f) => f.file).sort()).toEqual([
        'docs/spikes/s7-push.md',
        'spikes/s7-push/.out/logs/sends.jsonl',
        'spikes/s7-push/probe/lib/new.dart',
        'spikes/s7-push/sender/src/leak.ts',
      ]);
      for (const f of findings) expect(f.reason).toMatch(/\S/);
      // A finding never repeats the secret it found.
      expect(JSON.stringify(findings)).not.toContain(content.trim());
    });
  }

  it('fails when google-services.json or a service-account file is tracked, even if clean', () => {
    const files = {
      ...CLEAN,
      'spikes/s7-push/probe/android/app/google-services.json': '{}',
      'spikes/s7-push/service-account-s7.json': '{}',
    };
    const root = repo(files);
    const findings = checkNoSecrets({ repoRoot: root, listFiles: listed(Object.keys(files)) });
    expect(findings.map((f) => f.file).sort()).toEqual([
      'spikes/s7-push/probe/android/app/google-services.json',
      'spikes/s7-push/service-account-s7.json',
    ]);
  });

  it('ignores the git-ignored config and the device registry (state/), which must hold them', () => {
    const files = {
      ...CLEAN,
      'spikes/s7-push/probe/android/app/google-services.json': PLANTS['google-services body'] ?? '',
      'spikes/s7-push/.out/state/devices.jsonl': PLANTS['FCM token'] ?? '',
    };
    const root = repo(files);
    expect(checkNoSecrets({ repoRoot: root, listFiles: listed(Object.keys(CLEAN)) })).toEqual([]);
  });
});
