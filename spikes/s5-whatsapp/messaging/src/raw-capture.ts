// Manual run only (criterion 11, ADR-0026): every webhook body, byte for byte, and its WAHA
// headers go to a git-ignored folder (`.cache/s5/raw/`) so the scrubber can recompute the
// signature and write scrubbed fixtures. Files are owner-only; nothing about them is logged.
import { mkdirSync, writeFileSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { join } from 'node:path';

export interface RawCapture {
  container: string;
  receivedAt: string;
  /** Only `content-type` and WAHA's `x-webhook-*` headers. */
  headers: Record<string, string>;
  /** The raw body exactly as received (UTF-8). */
  body: string;
}

let seq = 0;

export function captureRaw(
  dir: string,
  container: string,
  headers: IncomingHttpHeaders,
  raw: Buffer,
  now: number,
): void {
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value !== 'string') continue;
    if (name === 'content-type' || name.startsWith('x-webhook-')) kept[name] = value;
  }
  const capture: RawCapture = {
    container,
    receivedAt: new Date(now).toISOString(),
    headers: kept,
    body: raw.toString('utf8'),
  };
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const name = `${String(now)}-${String(process.pid)}-${String(++seq).padStart(6, '0')}.json`;
  writeFileSync(join(dir, name), JSON.stringify(capture), { mode: 0o600 });
}
