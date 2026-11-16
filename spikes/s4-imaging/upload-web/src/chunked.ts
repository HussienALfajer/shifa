// Chunked resumable upload against the gateway (see gateway/src/uploads.ts). The session comes
// from the manifest, so after a reload (folder re-selected) or in a second tab the server's
// offsets say where to go on. A failed request is never retried blind: the page first asks the
// server for its offset (a small GET, repeated with backoff while the link is down), then sends
// from there, so an interruption costs at most the chunk that was in flight.
import { sha256 } from 'hash-wasm';
import type { Item } from './manifest.ts';
import { backoff, interrupted, report, stats, token } from './stats.ts';

interface SessionFile {
  index: number;
  path: string;
  received: number;
  state: 'pending' | 'done' | 'skipped';
}
interface Session {
  uploadId: string;
  chunkSize: number;
  files: SessionFile[];
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${await token()}`);
  return fetch(path, { ...init, headers });
}

/** Retries a small request until the server answers (link cuts, gateway restarts). */
async function settle<T>(attempt: () => Promise<Response>): Promise<T> {
  for (let n = 0; ; n += 1) {
    try {
      const res = await attempt();
      if (res.ok) return (await res.json()) as T;
    } catch {
      // the link is down: try again
    }
    await backoff(Math.min(n, 6));
  }
}

/** Hex digest → base64 (hash-wasm: WebCrypto needs a secure context, the spike is plain HTTP). */
const MAX_FAILURES = 12;

const b64 = (hex: string) =>
  btoa(String.fromCharCode(...(hex.match(/../g) ?? []).map((h) => Number.parseInt(h, 16))));

export async function uploadChunked(items: Item[], chunkOverride: number | null): Promise<void> {
  const manifest = { files: items.map(({ path, size, sha256 }) => ({ path, size, sha256 })) };
  const open = () =>
    call('/uploads', {
      method: 'POST',
      body: JSON.stringify(manifest),
      headers: { 'content-type': 'application/json' },
    });
  const session = await settle<Session>(open);
  const chunk = chunkOverride ?? session.chunkSize;
  stats.chunkSize = chunk;
  stats.resumedBytes = session.files.reduce((n, f) => n + f.received, 0);
  const byPath = new Map(items.map((i) => [i.path, i]));
  await report();

  for (const entry of session.files) {
    if (entry.state !== 'pending') continue;
    const item = byPath.get(entry.path);
    if (!item) throw new Error('manifest mismatch');
    let offset = entry.received;
    /** The server's offset as last reported: acknowledged bytes are its increase. */
    let known = entry.received;
    let state: SessionFile['state'] = entry.state;
    /** Failed PUTs in a row: backed off, and the upload gives up after too many. */
    let failures = 0;
    while (state === 'pending') {
      if (offset >= item.size) {
        // Complete on the server but not stored yet (a STOW failed): send the last chunk again.
        offset = Math.max(0, item.size - chunk);
      }
      const end = Math.min(offset + chunk, item.size);
      const body = new Uint8Array(await item.file.slice(offset, end).arrayBuffer());
      const digest = b64(await sha256(body));
      stats.sentBytes += body.length;
      let res: Response | null;
      try {
        res = await call(`/uploads/${session.uploadId}/files/${String(entry.index)}`, {
          method: 'PUT',
          body,
          headers: {
            'content-type': 'application/octet-stream',
            'content-range': `bytes ${String(offset)}-${String(end - 1)}/${String(item.size)}`,
            digest: `sha-256=${digest}`,
          },
        });
      } catch {
        res = null;
      }
      if (res?.status === 200) {
        failures = 0;
        const answer = (await res.json()) as { received: number; state: SessionFile['state'] };
        stats.ackedBytes += Math.max(0, answer.received - known);
        known = Math.max(known, answer.received);
        offset = answer.received;
        state = answer.state;
      } else {
        interrupted(item.path);
        failures += 1;
        // A dropped line recovers in `settle`; an answer that keeps failing (Orthanc down, a
        // file changed after the manifest) must not loop at full speed or forever.
        if (failures > MAX_FAILURES) throw new Error('upload keeps failing');
        if (res) await backoff(Math.min(failures, 6));
        // Ask the server where this file stands before sending anything again.
        const now = await settle<Session>(() => call(`/uploads/${session.uploadId}`));
        const current = now.files[entry.index];
        offset = current?.received ?? 0;
        if (current && current.received > known) {
          stats.ackedBytes += current.received - known;
          known = current.received;
        }
        state = current?.state ?? 'pending';
      }
      await report();
    }
  }
  const finished = await settle<{ done: number; skipped: string[] }>(() =>
    call(`/uploads/${session.uploadId}/finish`, { method: 'POST' }),
  );
  stats.skipped.push(...finished.skipped);
}
