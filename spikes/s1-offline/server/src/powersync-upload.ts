// POST /powersync/upload — the PowerSync connector's CRUD batch → the same command handler as
// POST /commands (no second write path, criterion 4). Only inserts into the client's
// `outbox_command` table are commands; the optimistic writes to synced tables are ignored (the
// server state replaces them on the next checkpoint).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MAX_BATCH } from './commands.ts';
import { handleBatch } from './handler/index.ts';
import type { SyncDeps } from './sync.ts';

const Entry = z.object({
  op: z.string(),
  type: z.string(),
  id: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});
const Body = z.object({ batch: z.array(Entry).max(MAX_BATCH * 4) });

/** An outbox row as the web and Flutter PowerSync clients write it. */
function toCommand(id: string, data: Record<string, unknown>): unknown {
  let payload: unknown;
  try {
    payload = typeof data['payload'] === 'string' ? JSON.parse(data['payload']) : undefined;
  } catch {
    payload = undefined;
  }
  return {
    id,
    type: data['type'],
    deviceId: data['device_id'],
    offline: data['offline'] === 1 || data['offline'] === true,
    clientTime: data['client_time'],
    payload,
  };
}

export function registerPowerSyncUpload(app: FastifyInstance, deps: SyncDeps): void {
  app.post('/powersync/upload', async (req, reply) => {
    const principal = await deps.principalOf(req);
    if (!principal) return reply.code(401).send({ error: 'unauthenticated' });
    const body = Body.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_batch' });
    const commands = body.data.batch
      .filter((e) => e.type === 'outbox_command' && e.op === 'PUT')
      .map((e) => toCommand(e.id, e.data ?? {}));
    const results = commands.length
      ? await handleBatch({ db: deps.db, log: deps.log }, principal, commands)
      : [];
    deps.log({ event: 'powersync_upload', tenantId: principal.tenantId, count: results.length });
    return { results };
  });
}
