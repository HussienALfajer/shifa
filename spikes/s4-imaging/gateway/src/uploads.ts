// Chunked resumable upload (0.3-S4b, criterion 8; throwaway). State lives on the server only:
// a session per tenant and folder (id = hash of tenant and manifest, so a reload or a second
// tab finds the same session and offsets), byte offsets in PostgreSQL, bytes in a per-session
// directory named by file index (manifest paths are display-only, never file-system paths).
// A chunk is appended only at the current offset, after its SHA-256 digest is checked, and
// fsynced before the answer; a row lock serialises two tabs on one file. A complete file whose
// SHA-256 matches the manifest is stored in the tenant's Orthanc by STOW-RS and audited; a
// file without the DICM preamble, or one Orthanc refuses, is skipped and listed.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, rm, truncate } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { request } from 'undici';
import { stowStudyUid } from './audit.ts';
import { type Context, ERROR_BODY, readBody } from './context.ts';

export const CHUNK_BYTES = 1024 * 1024;
export const MAX_CHUNK_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 20_000;
export const MAX_TOTAL_BYTES = 2 * 1024 ** 3;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
const ID = /^[0-9a-f]{32}$/;
const INDEX = /^(0|[1-9][0-9]{0,4})$/;

interface FileRow {
  idx: number;
  path: string;
  size: string;
  sha256: string;
  received: string;
  state: 'pending' | 'done' | 'skipped';
}

const view = (rows: FileRow[]) =>
  rows.map((r) => ({
    index: r.idx,
    path: r.path,
    size: Number(r.size),
    received: Number(r.received),
    state: r.state,
  }));

interface Entry {
  path: string;
  size: number;
  sha256: string;
}

/** Validates the manifest; returns the entries sorted by path or the refusal status. */
function parseManifest(body: Buffer): Entry[] | 400 | 413 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    return 400;
  }
  const files = (parsed as { files?: unknown } | null)?.files;
  if (!Array.isArray(files) || files.length === 0) return 400;
  if (files.length > MAX_FILES) return 413;
  const entries: Entry[] = [];
  let total = 0;
  for (const f of files as Record<string, unknown>[]) {
    const { path, size, sha256 } = f;
    if (typeof path !== 'string' || path.length === 0 || path.length > 1024) return 400;
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1) return 400;
    if (typeof sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(sha256)) return 400;
    total += size;
    entries.push({ path, size, sha256 });
  }
  if (total > MAX_TOTAL_BYTES) return 413;
  entries.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  if (entries.some((e, i) => i > 0 && entries[i - 1]?.path === e.path)) return 400;
  return entries;
}

export function registerUploads(app: FastifyInstance, ctx: Context): void {
  const { config } = ctx;
  const pool = config.pool;
  const fileDir = (id: string) => join(config.uploadDir, id);
  const filePath = (id: string, index: number) => join(fileDir(id), `${String(index)}.part`);
  const rowsOf = async (db: pg.Pool | pg.PoolClient, id: string, tenant: string) =>
    (
      await db.query<FileRow>(
        `select f.idx, f.path, f.size, f.sha256, f.received, f.state
           from s4.upload_file f join s4.upload_session s on s.id = f.upload_id
          where s.id = $1 and s.tenant_id = $2 order by f.idx`,
        [id, tenant],
      )
    ).rows;

  app.post('/uploads', async (req, reply) => {
    const start = performance.now();
    const auth = await ctx.bearer(req, reply, ['uploader'], start);
    if (!auth.ok) return reply;
    const { tenant, actor } = auth.principal;
    const length = Number(req.headers['content-length']);
    if (Number.isSafeInteger(length) && length > MAX_MANIFEST_BYTES) {
      return ctx.refuse(reply, 413, start, tenant);
    }
    const body = await readBody(req.body as Readable | undefined, MAX_MANIFEST_BYTES);
    if (!body) return ctx.refuse(reply, 413, start, tenant);
    const entries = parseManifest(body);
    if (typeof entries === 'number') return ctx.refuse(reply, entries, start, tenant);
    const manifestHash = createHash('sha256').update(JSON.stringify(entries)).digest('hex');
    const id = createHash('sha256').update(`${tenant}\n${manifestHash}`).digest('hex').slice(0, 32);
    await pool.query(
      'insert into s4.upload_session (id, tenant_id, actor) values ($1, $2, $3) on conflict (id) do nothing',
      [id, tenant, actor],
    );
    await pool.query(
      `insert into s4.upload_file (upload_id, idx, path, size, sha256)
         select $1, i - 1, p, s, h
           from unnest($2::text[], $3::bigint[], $4::text[]) with ordinality as t(p, s, h, i)
       on conflict (upload_id, idx) do nothing`,
      [id, entries.map((e) => e.path), entries.map((e) => e.size), entries.map((e) => e.sha256)],
    );
    const rows = await rowsOf(pool, id, tenant);
    ctx.finish(reply, 200, 'upload-open', tenant, start);
    return reply.send({ uploadId: id, chunkSize: CHUNK_BYTES, files: view(rows) });
  });

  app.get<{ Params: { id: string } }>('/uploads/:id', async (req, reply) => {
    const start = performance.now();
    const auth = await ctx.bearer(req, reply, ['uploader'], start);
    if (!auth.ok) return reply;
    const { tenant } = auth.principal;
    const id = req.params.id;
    const rows = ID.test(id) ? await rowsOf(pool, id, tenant) : [];
    if (rows.length === 0) return ctx.refuse(reply, 404, start, tenant);
    ctx.finish(reply, 200, 'upload-state', tenant, start);
    return reply.send({ uploadId: id, chunkSize: CHUNK_BYTES, files: view(rows) });
  });

  app.post<{ Params: { id: string } }>('/uploads/:id/finish', async (req, reply) => {
    const start = performance.now();
    const auth = await ctx.bearer(req, reply, ['uploader'], start);
    if (!auth.ok) return reply;
    const { tenant } = auth.principal;
    const id = req.params.id;
    const rows = ID.test(id) ? await rowsOf(pool, id, tenant) : [];
    if (rows.length === 0) return ctx.refuse(reply, 404, start, tenant);
    const pending = rows.filter((r) => r.state === 'pending').map((r) => r.idx);
    if (pending.length > 0) {
      ctx.finish(reply, 409, 'upload-finish', tenant, start);
      return reply.code(409).send({ pending });
    }
    await pool.query(
      'update s4.upload_session set finished_at = coalesce(finished_at, now()) where id = $1',
      [id],
    );
    await rm(fileDir(id), { recursive: true, force: true });
    ctx.finish(reply, 200, 'upload-finish', tenant, start);
    return reply.send({
      done: rows.filter((r) => r.state === 'done').length,
      skipped: rows.filter((r) => r.state === 'skipped').map((r) => r.path),
    });
  });

  app.put<{ Params: { id: string; index: string } }>(
    '/uploads/:id/files/:index',
    async (req, reply) => {
      const start = performance.now();
      const auth = await ctx.bearer(req, reply, ['uploader'], start);
      if (!auth.ok) return reply;
      const { tenant, actor } = auth.principal;
      const { id, index: indexText } = req.params;
      if (!ID.test(id) || !INDEX.test(indexText)) return ctx.refuse(reply, 404, start, tenant);
      const index = Number(indexText);
      const length = Number(req.headers['content-length']);
      if (Number.isSafeInteger(length) && length > MAX_CHUNK_BYTES) {
        return ctx.refuse(reply, 413, start, tenant);
      }
      const range = /^bytes (\d{1,12})-(\d{1,12})\/(\d{1,12})$/.exec(
        req.headers['content-range'] ?? '',
      );
      const digest = /^sha-256=([A-Za-z0-9+/]{43}=)$/.exec(String(req.headers['digest'] ?? ''));
      if (!range || !digest) return ctx.refuse(reply, 400, start, tenant);
      const [first, last, total] = [Number(range[1]), Number(range[2]), Number(range[3])];
      const body = await readBody(req.body as Readable | undefined, MAX_CHUNK_BYTES);
      if (!body) return ctx.refuse(reply, 413, start, tenant);
      if (body.length === 0 || last - first + 1 !== body.length) {
        return ctx.refuse(reply, 400, start, tenant);
      }
      if (createHash('sha256').update(body).digest('base64') !== digest[1]) {
        return ctx.refuse(reply, 400, start, tenant);
      }

      const db = await pool.connect();
      try {
        await db.query('begin');
        const row = (
          await db.query<FileRow>(
            `select f.idx, f.path, f.size, f.sha256, f.received, f.state
               from s4.upload_file f join s4.upload_session s on s.id = f.upload_id
              where s.id = $1 and s.tenant_id = $2 and f.idx = $3 for update of f`,
            [id, tenant, index],
          )
        ).rows[0];
        if (!row) {
          await db.query('rollback');
          return await ctx.refuse(reply, 404, start, tenant);
        }
        const size = Number(row.size);
        let received = Number(row.received);
        if (total !== size || last >= size) {
          await db.query('rollback');
          return await ctx.refuse(reply, 400, start, tenant);
        }
        let state = row.state;
        let status = 200;
        if (state === 'pending' && first === received) {
          await mkdir(fileDir(id), { recursive: true });
          const handle = await open(filePath(id, index), 'a');
          try {
            await handle.write(body);
            await handle.sync();
          } finally {
            await handle.close();
          }
          received += body.length;
          await db.query(
            'update s4.upload_file set received = $3 where upload_id = $1 and idx = $2',
            [id, index, received],
          );
        } else if (state === 'pending' && !(last < received)) {
          await db.query('rollback');
          ctx.finish(reply, 409, 'upload-chunk', tenant, start);
          return await reply.code(409).send({ received });
        }
        // A file complete on disk but not yet stored (new, or a STOW that failed before).
        if (state === 'pending' && received === size) {
          const outcome = await complete(ctx, tenant, actor, filePath(id, index), row.sha256);
          if (outcome === 'mismatch') {
            await truncate(filePath(id, index), 0);
            received = 0;
            status = 422;
          } else if (outcome === 'unavailable') {
            status = 502;
          } else {
            state = outcome;
            await rm(filePath(id, index), { force: true });
          }
          await db.query(
            'update s4.upload_file set received = $3, state = $4 where upload_id = $1 and idx = $2',
            [id, index, received, state],
          );
        }
        await db.query('commit');
        ctx.finish(reply, status, 'upload-chunk', tenant, start);
        if (status === 502) return await reply.code(502).send({ error: ERROR_BODY[502] });
        return await reply
          .code(status)
          .send({ received: state === 'pending' ? received : size, state });
      } catch (error) {
        await db.query('rollback').catch(() => undefined);
        throw error;
      } finally {
        db.release();
      }
    },
  );
}

/** Checks a complete file and stores it: done, skipped, mismatch or unavailable. */
async function complete(
  ctx: Context,
  tenant: string,
  actor: string,
  path: string,
  expected: string,
): Promise<'done' | 'skipped' | 'mismatch' | 'unavailable'> {
  const hash = createHash('sha256');
  const preamble: Buffer[] = [];
  let seen = 0;
  for await (const part of createReadStream(path) as AsyncIterable<Buffer>) {
    hash.update(part);
    if (seen < 132) preamble.push(part.subarray(0, 132 - seen));
    seen += part.length;
  }
  if (hash.digest('hex') !== expected) return 'mismatch';
  if (Buffer.concat(preamble).subarray(128, 132).toString('latin1') !== 'DICM') return 'skipped';

  const upstream = ctx.config.upstreams[tenant];
  if (!upstream) return 'unavailable';
  const boundary = `s4-${createHash('sha256').update(path).digest('hex').slice(0, 24)}`;
  const head = Buffer.from(`--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  async function* parts() {
    yield head;
    yield* createReadStream(path) as AsyncIterable<Buffer>;
    yield tail;
  }
  ctx.metrics.upstream += 1;
  let status: number;
  let text: string;
  try {
    const res = await request(`${upstream.url}/dicom-web/studies`, {
      method: 'POST',
      headers: {
        authorization: upstream.authorization,
        accept: 'application/dicom+json',
        'content-type': `multipart/related; type="application/dicom"; boundary=${boundary}`,
        'content-length': String(head.length + seen + tail.length),
      },
      body: Readable.from(parts()),
      headersTimeout: 300_000,
      bodyTimeout: 0,
    });
    status = res.statusCode;
    text = await res.body.text();
  } catch {
    return 'unavailable';
  }
  if (status >= 500) return 'unavailable';
  const stored = status < 400 && text.includes('"00081199"');
  if (!stored) return 'skipped';
  await ctx.config.audit.write({
    actor,
    tenant,
    studyUid: stowStudyUid(text),
    action: 'upload',
    routeClass: 'upload-file',
    status,
  });
  ctx.metrics.audited += 1;
  return 'done';
}
