// Key-leak check for spike 0.3-S7 (ADR-0026: the repository is public). Fails if a file of the
// spike that git would commit (tracked, or untracked and not ignored), a run log under
// `.out/logs/`, or a doc of the spike (`docs/spikes/s7-*`, `docs/slices/0.3-s7*`, ADR-0038) holds
// a private key, a service-account object, a Firebase API key, a google-services.json body, a
// full FCM token or a Google OAuth access token; if such a file is an archive or too large to
// scan; or if the app config or a key file is tracked anywhere. UTF-16 files (PowerShell 5.1 `>`)
// are decoded. Findings name the file and the kind, never the match.
// Run: node scripts/check-no-secrets.ts (from this package; also part of its `lint`, so `verify`
// and PR CI run it) — exit 1 on any finding.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

export interface SecretFinding {
  file: string;
  reason: string;
}

export interface GitFiles {
  tracked: string[];
  untracked: string[];
}

const SCOPES = ['spikes/s7-push/', 'docs/spikes/s7-', 'docs/slices/0.3-s7', 'docs/adr/0038-'];
const LOGS = 'spikes/s7-push/.out/logs';
/** Larger files are reported, not skipped: a run log must be split or summarised. */
const MAX_BYTES = 64 * 1024 * 1024;
const ARCHIVE = /\.(zip|gz|tgz|7z|rar|tar|apk|aab|hprof)$/i;

// Each pattern is written so its own source text does not match it.
const PATTERNS: { reason: string; pattern: RegExp }[] = [
  { reason: 'private key block', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { reason: 'service-account object', pattern: /"type"\s*:\s*"service_account"/ },
  { reason: 'private key field', pattern: /"private_key"\s*:\s*"/ },
  { reason: 'Firebase API key', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { reason: 'google-services.json body', pattern: /"project_info"\s*:/ },
  // Anchored on the fixed marker, so a long run of token characters stays linear.
  { reason: 'full FCM token', pattern: /:APA91b[A-Za-z0-9_-]{100,}/ },
  { reason: 'Google OAuth access token', pattern: /ya29\.[0-9A-Za-z_-]{20,}/ },
];

/** Config and key files that must never be tracked (console default names included). */
const FORBIDDEN_TRACKED = (path: string) => {
  const name = basename(path);
  return (
    name === 'google-services.json' ||
    name === 'GoogleService-Info.plist' ||
    /^service-account.*\.json$/i.test(name) ||
    /-firebase-adminsdk-.*\.json$/i.test(name) ||
    (path.startsWith('spikes/s7-push/') &&
      (name === 'firebase_options.dart' || name === '.firebaserc'))
  );
};

const toPosix = (p: string) => p.split(sep).join('/');

/** UTF-16 when there is a BOM or many odd bytes are NUL; UTF-8 otherwise. */
function decode(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff)
    return Buffer.from(buf).swap16().toString('utf16le');
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
  const sample = Math.min(buf.length, 4096);
  let nulls = 0;
  for (let i = 1; i < sample; i += 2) if (buf[i] === 0) nulls += 1;
  return sample > 8 && nulls > sample / 4 ? buf.toString('utf16le') : buf.toString('utf8');
}

function walk(root: string, dir: string): string[] {
  const full = join(root, dir);
  if (!existsSync(full)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(root, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

export function gitFiles(repoRoot: string): GitFiles {
  const list = (args: string[]) =>
    execFileSync('git', ['ls-files', '-z', ...args], { cwd: repoRoot, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
  return { tracked: list([]), untracked: list(['--others', '--exclude-standard']) };
}

export function checkNoSecrets(opts: {
  repoRoot: string;
  listFiles?: () => GitFiles;
}): SecretFinding[] {
  const { tracked, untracked } = (opts.listFiles ?? (() => gitFiles(opts.repoRoot)))();
  const findings: SecretFinding[] = [];

  for (const file of tracked.map(toPosix)) {
    if (FORBIDDEN_TRACKED(file)) findings.push({ file, reason: 'config or key file is tracked' });
  }

  const inScope = (f: string) => SCOPES.some((scope) => f.startsWith(scope));
  const candidates = new Set<string>([...tracked, ...untracked].map(toPosix).filter(inScope));
  for (const log of walk(opts.repoRoot, LOGS)) candidates.add(log);

  for (const file of [...candidates].sort()) {
    if (findings.some((f) => f.file === file)) continue;
    const full = join(opts.repoRoot, file);
    if (!existsSync(full)) continue;
    if (ARCHIVE.test(file)) {
      findings.push({ file, reason: 'archive or dump cannot be scanned' });
      continue;
    }
    if (statSync(full).size > MAX_BYTES) {
      findings.push({ file, reason: 'too large to scan' });
      continue;
    }
    const text = decode(readFileSync(full));
    const hit = PATTERNS.find((p) => p.pattern.test(text));
    if (hit) findings.push({ file, reason: hit.reason });
  }
  return findings;
}

if (import.meta.main) {
  const repoRoot = toPosix(
    relative(process.cwd(), join(import.meta.dirname, '..', '..', '..', '..')),
  );
  const findings = checkNoSecrets({ repoRoot: repoRoot || '.' });
  for (const f of findings) process.stderr.write(`${f.file}: ${f.reason}\n`);
  process.stdout.write(`s7 key-leak check: ${findings.length === 0 ? 'pass' : 'fail'}\n`);
  process.exit(findings.length === 0 ? 0 : 1);
}
