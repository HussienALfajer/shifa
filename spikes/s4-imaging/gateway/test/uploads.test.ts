// Criterion 8, server half: the chunked resumable upload on the gateway. A manifest opens one
// session per tenant and folder (a second tab or a reload gets the same id and offsets); chunks
// append only at the server offset, with a per-chunk digest; a complete file whose SHA-256
// matches is stored once in the tenant's Orthanc and audited; non-DICOM files are skipped;
// another tenant's token sees no session; limits are enforced.
import { randomBytes } from 'node:crypto';
import { ensureStudy, type Manifest } from '@shifa-spike/s4-generator';
import { orthanc, sha256, useStack } from '@shifa-spike/s4-stack/testing';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer } from './tokens.ts';
import {
  digest,
  entries,
  entryOf,
  fileBytes,
  MiB,
  type Session,
  uploadClient,
} from './upload-client.ts';

const stack = useStack();
let single: { dir: string; manifest: Manifest };
let multi: { dir: string; manifest: Manifest };
let a: ReturnType<typeof uploadClient>;
let b: ReturnType<typeof uploadClient>;
let db: pg.Client;

const instancesIn = async (tenant: 'a' | 'b') =>
  (await (await orthanc(stack.tenants[tenant], '/instances')).json()) as string[];

beforeAll(async () => {
  [single, multi] = [await ensureStudy('cbct-20-single'), await ensureStudy('cbct-20-multi')];
  a = uploadClient(
    stack.gatewayUrl,
    await stack.token({ sub: 'up-a', tenant: 'a', role: 'uploader' }),
  );
  b = uploadClient(
    stack.gatewayUrl,
    await stack.token({ sub: 'up-b', tenant: 'b', role: 'uploader' }),
  );
  const url = new URL(stack.postgres.url);
  url.pathname = '/s4_gateway';
  db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
});
afterAll(async () => {
  await db.end();
});

describe('chunked resumable upload', () => {
  let session: Session;

  it('opens a session from a manifest, files ordered by path, nothing received', async () => {
    session = await a.session(entries(single.manifest));
    expect(session.uploadId).toMatch(/^[0-9a-f]{32}$/);
    expect(session.chunkSize).toBe(MiB);
    expect(session.files).toEqual([
      expect.objectContaining({ index: 0, received: 0, state: 'pending' }),
    ]);
  });

  it('gives a second tab the same session and the server offsets', async () => {
    const [file] = session.files;
    if (!file) throw new Error('no file');
    const bytes = await fileBytes(single.dir, file.path);
    const first = await a.put(session.uploadId, 0, bytes.subarray(0, MiB), 0, bytes.length);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ received: MiB, state: 'pending' });
    const again = await a.session(entries(single.manifest).reverse());
    expect(again.uploadId).toBe(session.uploadId);
    expect(again.files[0]?.received).toBe(MiB);
  });

  it('refuses a chunk past the offset with 409 and the offset', async () => {
    const bytes = await fileBytes(single.dir, single.manifest.files[0]?.path ?? '');
    const res = await a.put(
      session.uploadId,
      0,
      bytes.subarray(2 * MiB, 3 * MiB),
      2 * MiB,
      bytes.length,
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ received: MiB });
  });

  it('answers a repeated chunk with the offset and stores no byte twice', async () => {
    const bytes = await fileBytes(single.dir, single.manifest.files[0]?.path ?? '');
    const res = await a.put(session.uploadId, 0, bytes.subarray(0, MiB), 0, bytes.length);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: MiB });
  });

  it('refuses a chunk whose digest does not match and keeps the offset', async () => {
    const bytes = await fileBytes(single.dir, single.manifest.files[0]?.path ?? '');
    const chunk = bytes.subarray(MiB, 2 * MiB);
    const res = await a.put(session.uploadId, 0, chunk, MiB, bytes.length, digest(randomBytes(8)));
    expect(res.status).toBe(400);
    const state = (await (await a.state(session.uploadId)).json()) as Session;
    expect(state.files[0]?.received).toBe(MiB);
  });

  it('stores a complete, matching file once in Orthanc and audits it', async () => {
    const [file] = (await a.session(entries(single.manifest))).files;
    if (!file) throw new Error('no file');
    const bytes = await fileBytes(single.dir, file.path);
    const last = await a.sendFile(session.uploadId, file, bytes, MiB);
    expect(last.status).toBe(200);
    expect(await last.json()).toEqual({ received: bytes.length, state: 'done' });
    expect(await instancesIn('a')).toHaveLength(1);
    expect(await instancesIn('b')).toHaveLength(0);
    const [id] = await instancesIn('a');
    const stored = await orthanc(stack.tenants.a, `/instances/${id ?? ''}/file`);
    expect(sha256(new Uint8Array(await stored.arrayBuffer()))).toBe(sha256(bytes));
    expect((await a.finish(session.uploadId)).status).toBe(200);
    const audit = await db.query<{ actor: string; study_uid: string; action: string }>(
      "select actor, study_uid, action from s4.audit where action = 'upload'",
    );
    expect(audit.rows).toEqual([
      { actor: 'up-a', study_uid: single.manifest.studyInstanceUid, action: 'upload' },
    ]);
  });

  it('needs no PUT for a study already complete and keeps one copy', async () => {
    const again = await a.session(entries(single.manifest));
    expect(again.uploadId).toBe(session.uploadId);
    expect(again.files.every((f) => f.state === 'done')).toBe(true);
    expect((await a.finish(again.uploadId)).status).toBe(200);
    expect(await instancesIn('a')).toHaveLength(1);
  });

  it('uploads a multi-file study, skips a non-DICOM file and lists it', async () => {
    const junk = Buffer.from('not a DICOM file, a readme the scanner software left\n');
    const files = [...entries(multi.manifest).slice(0, 5), entryOf('README.TXT', junk)];
    const s = await a.session(files);
    for (const file of s.files) {
      const bytes = file.path === 'README.TXT' ? junk : await fileBytes(multi.dir, file.path);
      const res = await a.sendFile(s.uploadId, file, bytes, MiB);
      expect(res.status, file.path).toBe(200);
    }
    const done = (await (await a.state(s.uploadId)).json()) as Session;
    expect(done.files.filter((f) => f.state === 'skipped').map((f) => f.path)).toEqual([
      'README.TXT',
    ]);
    const finished = await a.finish(s.uploadId);
    expect(finished.status).toBe(200);
    expect(await finished.json()).toEqual({ done: 5, skipped: ['README.TXT'] });
    expect(await instancesIn('a')).toHaveLength(6);
  });

  it('refuses to finish while a file is pending', async () => {
    const s = await a.session(entries(multi.manifest).slice(5, 7));
    const res = await a.finish(s.uploadId);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ pending: [0, 1] });
  });

  it("shows tenant B nothing of A's session", async () => {
    const id = session.uploadId;
    const bytes = Buffer.alloc(16);
    expect((await b.state(id)).status).toBe(404);
    expect((await b.put(id, 0, bytes, 0, 16)).status).toBe(404);
    expect((await b.finish(id)).status).toBe(404);
    // The same folder from B opens B's own session.
    expect((await b.session(entries(single.manifest))).uploadId).not.toBe(id);
  });

  it('enforces roles and limits', async () => {
    const viewer = uploadClient(
      stack.gatewayUrl,
      await stack.token({ tenant: 'a', role: 'viewer' }),
    );
    expect((await viewer.open(entries(single.manifest))).status).toBe(403);
    const many = Array.from({ length: 20_001 }, (_, i) => ({
      path: `f${String(i)}`,
      size: 1,
      sha256: '0'.repeat(64),
    }));
    expect((await a.open(many)).status).toBe(413);
    const huge = [{ path: 'big', size: 2 * 1024 ** 3 + 1, sha256: '0'.repeat(64) }];
    expect((await a.open(huge)).status).toBe(413);
    expect((await a.open([{ path: 'x', size: -1, sha256: 'zz' }])).status).toBe(400);
    const s = await a.session([{ path: 'big', size: 8 * MiB, sha256: '0'.repeat(64) }]);
    const tooBig = await a.put(s.uploadId, 0, Buffer.alloc(4 * MiB + 1), 0, 8 * MiB);
    expect(tooBig.status).toBe(413);
    const wrongTotal = await a.put(s.uploadId, 0, Buffer.alloc(16), 0, 9 * MiB);
    expect(wrongTotal.status).toBe(400);
    const noDigest = await fetch(`${stack.gatewayUrl}/uploads/${s.uploadId}/files/0`, {
      method: 'PUT',
      body: Buffer.alloc(16),
      headers: { ...bearer(await stack.token({ tenant: 'a', role: 'uploader' })) },
    });
    expect(noDigest.status).toBe(400);
  });
});
