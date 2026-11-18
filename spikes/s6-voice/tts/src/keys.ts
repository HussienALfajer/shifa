// Finds key patterns in the spike folder or the output/log folder (ADR-0026). Reports
// file, line and kind, never the matched value. `.env.local` is skipped: keys belong there.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
export interface KeyFinding {
  file: string;
  line: number;
  kind: 'azure-key' | 'google-api-key' | 'service-account' | 'generic-key' | 'local-secret';
}

const PATTERNS: [KeyFinding['kind'], RegExp][] = [
  // Azure AI Speech keys: the older 32-hex form and the newer 84-character form.
  ['azure-key', /\b[0-9a-fA-F]{32}\b|\b[0-9A-Za-z]{84}\b/gu],
  ['google-api-key', /AIza[0-9A-Za-z_-]{35}/gu],
  [
    'service-account',
    /"type"\s*:\s*"service_account"|"private_key"\s*:|-----BEGIN (?:RSA )?PRIVATE KEY-----/gu,
  ],
  [
    // No leading word boundary: S6_AZURE_KEY=…, "apiKey": "…", "ocp-apim-subscription-key":"…".
    'generic-key',
    /(?:api[_-]?key|subscription[_-]?key|access[_-]?key|secret|key)["']?\s*[=:]\s*["']?[A-Za-z0-9_\-+/]{16,}/giu,
  ],
];

const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo', 'playwright-report', 'test-results']);
const BINARY = new Set(['.wav', '.mp3', '.opus', '.ogg', '.webm', '.png', '.jpg', '.zip', '.gz']);
const MAX_BYTES = 5 * 1024 * 1024;

function* files(path: string): Generator<string> {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st) return;
  if (st.isFile()) {
    yield path;
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* files(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function skipFile(file: string): boolean {
  const name = file.split(/[\\/]/u).pop() ?? '';
  if (name === '.env.local') return true;
  if (BINARY.has(extname(name).toLowerCase())) return true;
  return statSync(file).size > MAX_BYTES;
}

/** UTF-8, or UTF-16 LE with a byte-order mark (Windows PowerShell 5.1 redirection writes it). */
function readText(file: string): string {
  const bytes = readFileSync(file);
  return bytes[0] === 0xff && bytes[1] === 0xfe
    ? bytes.subarray(2).toString('utf16le')
    : bytes.toString('utf8');
}

/**
 * `secrets` are the owner's real key values (from .env.local): found as literal strings, so a key
 * of a shape no pattern knows is still caught.
 */
export function scanForKeys(paths: string[], secrets: readonly string[] = []): KeyFinding[] {
  const findings: KeyFinding[] = [];
  for (const root of paths) {
    for (const file of files(root)) {
      if (skipFile(file)) continue;
      const text = readText(file);
      for (const secret of secrets) {
        const index = text.indexOf(secret);
        if (index >= 0) {
          findings.push({
            file,
            line: text.slice(0, index).split('\n').length,
            kind: 'local-secret',
          });
        }
      }
      for (const [kind, re] of PATTERNS) {
        for (const m of text.matchAll(re)) {
          const line = text.slice(0, m.index).split('\n').length;
          // One finding per kind and line (a service-account file matches several markers).
          if (!findings.some((f) => f.file === file && f.line === line && f.kind === kind)) {
            findings.push({ file, line, kind });
          }
        }
      }
    }
  }
  return findings;
}
