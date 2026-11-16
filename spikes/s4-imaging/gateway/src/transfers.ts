// Transfers push routes for the edge box (0.3-S4b, criterion 9, IMG-17). Only the receiving
// side of a push is exposed, only to an edge credential, and always to the Orthanc of the
// edge token's tenant: create a transaction, PUT its buckets, commit, abort. Pull, send,
// lookup, peers and chunks stay unreachable (404 by the default route). Bodies stream through;
// one audit row per commit (action push).
import type { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { request } from 'undici';
import { type Context, ERROR_BODY, unsafePath } from './context.ts';

const TX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BUCKET = /^(0|[1-9][0-9]{0,5})$/;
/** A bucket is about 4 MB (the plugin's default query size); the instance list is small. */
const MAX_BODY_BYTES = 64 * 1024 * 1024;

type Kind = 'create' | 'bucket' | 'commit' | 'abort';

export function registerTransfers(app: FastifyInstance, ctx: Context): void {
  const handle =
    (kind: Kind) =>
    async (
      req: FastifyRequest<{ Params: { id?: string; n?: string } }>,
      reply: FastifyReply,
    ): Promise<FastifyReply> => {
      const start = performance.now();
      const { id, n } = req.params;
      if (unsafePath(req.raw.url ?? '') || (req.raw.url ?? '').includes('?')) {
        return ctx.refuse(reply, 404, start);
      }
      if ((id !== undefined && !TX.test(id)) || (n !== undefined && !BUCKET.test(n))) {
        return ctx.refuse(reply, 404, start);
      }
      const auth = await ctx.bearer(req, reply, ['edge'], start);
      if (!auth.ok) return reply;
      const { tenant, actor } = auth.principal;
      const upstream = ctx.config.upstreams[tenant];
      if (!upstream) return ctx.refuse(reply, 403, start, tenant);

      const headers: Record<string, string> = { authorization: upstream.authorization };
      let body: Readable | undefined;
      if (kind === 'create' || kind === 'bucket') {
        const length = Number(req.headers['content-length']);
        if (!Number.isSafeInteger(length) || length <= 0 || length > MAX_BODY_BYTES) {
          return ctx.refuse(reply, 413, start, tenant);
        }
        headers['content-length'] = String(length);
        const type = req.headers['content-type'];
        if (typeof type === 'string') headers['content-type'] = type;
        body = req.body as Readable;
      }
      const path =
        kind === 'create'
          ? '/transfers/push'
          : kind === 'bucket'
            ? `/transfers/push/${id ?? ''}/${n ?? ''}`
            : kind === 'commit'
              ? `/transfers/push/${id ?? ''}/commit`
              : `/transfers/push/${id ?? ''}`;
      const method = kind === 'bucket' ? 'PUT' : kind === 'abort' ? 'DELETE' : 'POST';
      ctx.metrics.upstream += 1;
      let status: number;
      let text = '';
      try {
        const res = await request(`${upstream.url}${path}`, {
          method,
          headers,
          ...(body ? { body } : {}),
          headersTimeout: 1_800_000,
          bodyTimeout: 0,
        });
        status = res.statusCode;
        text = await res.body.text();
      } catch {
        status = 502;
      }
      const routeClass = `transfers-${kind}`;
      if (kind === 'commit') {
        try {
          await ctx.config.audit.write({
            actor,
            tenant,
            studyUid: null,
            action: 'push',
            routeClass,
            status,
          });
          ctx.metrics.audited += 1;
        } catch {
          ctx.finish(reply, 503, routeClass, tenant, start);
          return reply.code(503).send({ error: ERROR_BODY[503] });
        }
      }
      ctx.finish(reply, status, routeClass, tenant, start);
      if (status >= 400) {
        const code = status >= 500 ? 502 : status;
        return reply
          .code(code)
          .type('application/json')
          .send({ error: ERROR_BODY[code] ?? 'error' });
      }
      return reply.code(status).type('application/json').send(text);
    };

  app.post('/transfers/push', handle('create'));
  app.put('/transfers/push/:id/:n', handle('bucket'));
  app.post('/transfers/push/:id/commit', handle('commit'));
  app.delete('/transfers/push/:id', handle('abort'));
}
