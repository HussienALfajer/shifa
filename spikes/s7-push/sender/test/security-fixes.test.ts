// Regression tests for the 0.3-S7a security review: default key names, UTF-16, archives, large
// files, spike docs, OAuth access tokens, linear-time token pattern, and URL overrides.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkNoSecrets } from '../scripts/check-no-secrets.ts';
import { checkUrl, loadConfig } from '../src/env.ts';
import { tempDir } from './helpers.ts';

const TOKEN = ['d'.repeat(22), ':', 'APA', '91b', 'Z'.repeat(140)].join('');
const ACCESS = ['ya', '29.', 'a'.repeat(40)].join('');

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function repo(files: Record<string, string | Buffer>) {
  const t = tempDir('s7-secfix-');
  cleanup = t.cleanup;
  for (const [path, content] of Object.entries(files)) {
    const full = join(t.dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return t.dir;
}

const check = (root: string, tracked: string[], untracked: string[] = []) =>
  checkNoSecrets({ repoRoot: root, listFiles: () => ({ tracked, untracked }) })
    .map((f) => `${f.file}: ${f.reason}`)
    .sort();

describe('key-leak check after the security review', () => {
  it('fails on tracked keys and configs under their console default names', () => {
    const files = {
      'spikes/s7-push/shifa-prod-firebase-adminsdk-abc12-0123456789.json': '{}',
      'spikes/s7-push/probe/android/app/src/noshow/google-services.json': '{}',
      'spikes/s7-push/probe/lib/firebase_options.dart': '// generated',
    };
    expect(check(repo(files), Object.keys(files))).toEqual([
      'spikes/s7-push/probe/android/app/src/noshow/google-services.json: config or key file is tracked',
      'spikes/s7-push/probe/lib/firebase_options.dart: config or key file is tracked',
      'spikes/s7-push/shifa-prod-firebase-adminsdk-abc12-0123456789.json: config or key file is tracked',
    ]);
  });

  it('decodes UTF-16 (PowerShell 5.1 redirection) and finds the token', () => {
    const utf16 = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(`t=${TOKEN}\n`, 'utf16le'),
    ]);
    const root = repo({ 'spikes/s7-push/.out/logs/watch.txt': utf16 });
    expect(check(root, [])).toEqual(['spikes/s7-push/.out/logs/watch.txt: full FCM token']);
  });

  it('reports archives and dumps it cannot read', () => {
    const root = repo({ 'spikes/s7-push/runs/out.zip': Buffer.from([0x50, 0x4b, 3, 4]) });
    expect(check(root, [], ['spikes/s7-push/runs/out.zip'])).toEqual([
      'spikes/s7-push/runs/out.zip: archive or dump cannot be scanned',
    ]);
  });

  it('scans large files instead of skipping them, in linear time', () => {
    const big = `${'a'.repeat(5 * 1024 * 1024)}\n${TOKEN}\n`;
    const root = repo({ 'spikes/s7-push/runs/day.log': big });
    const started = Date.now();
    expect(check(root, ['spikes/s7-push/runs/day.log'])).toEqual([
      'spikes/s7-push/runs/day.log: full FCM token',
    ]);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('covers the spike slices and ADR-0038, and OAuth access tokens', () => {
    const files = {
      'docs/slices/0.3-s7b-push-runs-and-result.md': `curl -H "Authorization: Bearer ${ACCESS}"`,
      'docs/adr/0038-push-policy.md': ['"private', '_key": "x"'].join(''),
    };
    expect(check(repo(files), Object.keys(files))).toEqual([
      'docs/adr/0038-push-policy.md: private key field',
      'docs/slices/0.3-s7b-push-runs-and-result.md: Google OAuth access token',
    ]);
  });
});

describe('URL overrides', () => {
  it('allow https anywhere and http only to loopback', () => {
    expect(checkUrl('X', 'https://fcm.googleapis.com/')).toBe('https://fcm.googleapis.com');
    expect(checkUrl('X', 'http://127.0.0.1:9000')).toBe('http://127.0.0.1:9000');
    expect(() => checkUrl('X', 'http://192.168.1.5:9000')).toThrow(/https/);
    expect(() => checkUrl('X', 'not a url')).toThrow(/not a URL/);
  });

  it('a Google token never goes to a non-Google FCM URL', () => {
    const t = tempDir('s7-env-');
    cleanup = t.cleanup;
    const key = join(t.dir, 'key.json');
    writeFileSync(
      key,
      JSON.stringify({
        project_id: 'p',
        client_email: 'e@p.iam.gserviceaccount.com',
        private_key: 'k',
      }),
    );
    expect(() =>
      loadConfig({ S7_SERVICE_ACCOUNT_FILE: key, S7_FCM_BASE_URL: 'http://127.0.0.1:9000' }),
    ).toThrow(/must be Google FCM/);
    expect(
      loadConfig({
        S7_SERVICE_ACCOUNT_FILE: key,
        S7_FCM_BASE_URL: 'http://127.0.0.1:9000',
        S7_TOKEN_URL: 'http://127.0.0.1:9001/token',
      }).fcmBaseUrl,
    ).toBe('http://127.0.0.1:9000');
  });
});
