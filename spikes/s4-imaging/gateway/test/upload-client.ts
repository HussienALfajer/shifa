// Client side of the chunked upload protocol for the gateway suites (0.3-S4b, criterion 8):
// manifest from a generated study, session open, chunk PUTs with Content-Range and Digest.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Manifest } from '@shifa-spike/s4-generator';
import { bearer } from './tokens.ts';

export const MiB = 1024 * 1024;

export interface ManifestEntry {
  path: string;
  size: number;
  sha256: string;
}

export interface SessionFile {
  index: number;
  path: string;
  size: number;
  received: number;
  state: 'pending' | 'done' | 'skipped';
}

export interface Session {
  uploadId: string;
  chunkSize: number;
  files: SessionFile[];
}

export const entries = (manifest: Manifest): ManifestEntry[] =>
  manifest.files.map((f) => ({ path: f.path, size: f.bytes, sha256: f.sha256 }));

export const entryOf = (path: string, bytes: Uint8Array): ManifestEntry => ({
  path,
  size: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
});

export const digest = (bytes: Uint8Array) =>
  `sha-256=${createHash('sha256').update(bytes).digest('base64')}`;

export function uploadClient(gatewayUrl: string, token: string) {
  const open = async (files: ManifestEntry[]) =>
    fetch(`${gatewayUrl}/uploads`, {
      method: 'POST',
      body: JSON.stringify({ files }),
      headers: { ...bearer(token), 'content-type': 'application/json' },
    });
  const session = async (files: ManifestEntry[]): Promise<Session> => {
    const res = await open(files);
    if (res.status !== 200) throw new Error(`open: ${String(res.status)}`);
    return (await res.json()) as Session;
  };
  const put = (
    uploadId: string,
    index: number,
    chunk: Uint8Array,
    start: number,
    total: number,
    digestHeader = digest(chunk),
  ) =>
    fetch(`${gatewayUrl}/uploads/${uploadId}/files/${String(index)}`, {
      method: 'PUT',
      body: new Uint8Array(chunk),
      headers: {
        ...bearer(token),
        'content-type': 'application/octet-stream',
        'content-range': `bytes ${String(start)}-${String(start + chunk.length - 1)}/${String(total)}`,
        digest: digestHeader,
      },
    });
  const state = (uploadId: string) =>
    fetch(`${gatewayUrl}/uploads/${uploadId}`, { headers: bearer(token) });
  const finish = (uploadId: string) =>
    fetch(`${gatewayUrl}/uploads/${uploadId}/finish`, { method: 'POST', headers: bearer(token) });
  /** Sends the rest of one file from its server offset, chunk by chunk; returns the last answer. */
  const sendFile = async (
    uploadId: string,
    file: SessionFile,
    bytes: Uint8Array,
    chunkSize: number,
  ): Promise<Response> => {
    let offset = file.received;
    let last: Response | undefined;
    while (offset < bytes.length) {
      const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
      last = await put(uploadId, file.index, chunk, offset, bytes.length);
      if (last.status !== 200) return last;
      offset = ((await last.clone().json()) as { received: number }).received;
    }
    if (!last) throw new Error('nothing to send');
    return last;
  };
  return { open, session, put, state, finish, sendFile };
}

export const fileBytes = (dir: string, path: string) => readFile(join(dir, path));
