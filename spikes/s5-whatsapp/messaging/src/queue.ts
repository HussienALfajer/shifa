// pg-boss wiring (ADR-0003; criterion 5). One tick job per session (`singletonKey` = session) on
// a `stately` queue: at most one queued and one active tick per session. pg-boss 12.38 also has
// a `key_strict_fifo` policy, but a failed or expired job there holds back its key until it is
// cleaned up, and a deferred job lets later fetchable ones go first, so pacing and FIFO would
// break; FIFO comes from the attempt table instead (oldest `queued` row, session lock held).
// `retryLimit: 0`: a tick is never retried; the next tick finds what a dead one left behind.
import { PgBoss } from 'pg-boss';
import type { Ctx } from './context.ts';
import { tick } from './tick.ts';

const TICK = 's5-tick';
const HEALTH = 's5-health';

export interface Queue {
  kick(session: string, at?: number): Promise<void>;
  stop(): Promise<void>;
}

export async function startQueue(
  ctx: Ctx,
  mode: 'producer' | 'worker',
  runHealth: () => Promise<void>,
): Promise<Queue> {
  const { config } = ctx;
  const p = config.pacing;
  const expire =
    config.tickExpireSeconds ??
    Math.ceil((p.inlineWaitMaxMs + p.typing.maxMs + 4 * config.sendTimeoutMs) / 1000) + 30;
  const boss = new PgBoss({
    connectionString: config.databaseUrl,
    schema: 's5_boss',
    max: 5,
    superviseIntervalSeconds: config.tickExpireSeconds === undefined ? 60 : 1,
  });
  boss.on('error', () => {
    ctx.log('queue_error');
  });
  await boss.start();
  // Several processes may create the queues together; a lost race is fine.
  await boss
    .createQueue(TICK, { policy: 'stately', retryLimit: 0, expireInSeconds: expire })
    .catch(() => undefined);
  await boss.createQueue(HEALTH, { policy: 'stately', retryLimit: 0 }).catch(() => undefined);

  const kick = async (session: string, at?: number) => {
    const options = { singletonKey: session, retryLimit: 0, expireInSeconds: expire };
    await (at === undefined
      ? boss.send(TICK, { session }, options)
      : boss.send(TICK, { session }, { ...options, startAfter: new Date(at) }));
  };

  if (mode === 'worker') {
    await boss.work<{ session: string }>(
      TICK,
      // A tick may wait inline for its gap (up to inlineWaitMaxMs): one handler per session at
      // a time, so sessions never queue behind each other inside one worker (MSG-10).
      {
        pollingIntervalSeconds: 0.5,
        batchSize: 1,
        localConcurrency: Math.max(4, config.sessions.length),
      },
      async (jobs) => {
        for (const job of jobs) {
          const session = job.data.session;
          let result: Awaited<ReturnType<typeof tick>>;
          try {
            result = await tick(ctx, session);
          } catch {
            // A failed tick must not stall the session: try again shortly (the next tick
            // turns a row left in `sending` into "maybe sent").
            ctx.log('tick_error', { session });
            await kick(session, ctx.deps.now() + 5_000);
            continue;
          }
          // Kicks sent while this job is active take the one queued slot (stately).
          if (result === 'sent' || result === 'progress') await kick(session);
          if (result === 'busy') await kick(session, ctx.deps.now() + 500);
        }
      },
    );
    await boss.schedule(HEALTH, '*/5 * * * *').catch(() => undefined);
    await boss.work(HEALTH, async () => {
      await runHealth();
    });
    // Sessions with queued messages get a tick at start (a worker that died left them).
    const pending = await ctx.db.query<{ session: string }>(
      "select distinct session from s5.delivery_attempt where status in ('queued', 'sending')",
    );
    for (const row of pending) await kick(row.session);
  }

  return {
    kick,
    async stop() {
      await boss.stop({ graceful: true, timeout: 5_000 });
    },
  };
}
