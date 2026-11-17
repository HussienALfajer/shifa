// One step of a session's queue (criterion 5 and 6). A tick holds the session's advisory lock
// for its whole run, so two workers never overlap within a session; it takes the oldest queued
// message (FIFO), waits for the pacing rules, then seen → typing → send.
// At most once: `sending` is committed before the WAHA call and the outcome in a later
// transaction; a tick that finds a `sending` row while holding the lock knows its handler died
// and marks it `unknown` ("maybe sent" task) without calling WAHA.
import { tripBreaker } from './breaker.ts';
import { type Ctx, loadSession, sendable, ts } from './context.ts';
import { type Client, rows } from './db.ts';
import { fallbackQueued, markGatewayDown, settleAttempt } from './fallback.ts';
import { nextSendAt, typingMs } from './scheduler.ts';
import { banCode, chatOfPhone, type WahaResult, wahaCall } from './waha.ts';

export type TickResult = 'idle' | 'deferred' | 'sent' | 'progress' | 'busy';

interface Head {
  id: string;
  seq: string;
  clinic_id: string;
  patient_id: string;
  body: string;
  confirmation: boolean;
  phone: string;
  opted_out: boolean | null;
}

const HEAD_SQL = `
  select a.id, a.seq, a.clinic_id, a.patient_id, a.body, a.confirmation, p.phone, o.opted_out
  from s5.delivery_attempt a
  join s5.patient p on p.clinic_id = a.clinic_id and p.patient_id = a.patient_id
  left join s5.optin o on o.clinic_id = a.clinic_id and o.patient_id = a.patient_id
  where a.session = $1 and a.status = 'queued'
  order by a.seq limit 1`;

/** Marks rows left in `sending` by a dead handler as unknown (lock held: nobody else sends). */
async function sweepOrphans(ctx: Ctx, client: Client, session: string) {
  const orphans = await rows<{ id: string; seq: string }>(
    client,
    "select id, seq from s5.delivery_attempt where session = $1 and status = 'sending'",
    [session],
  );
  for (const o of orphans) {
    await settleAttempt(ctx, client, o.id, 'unknown', 'handler_lost', ['sending']);
    ctx.log('orphan_unknown', { session, seq: Number(o.seq) });
  }
}

async function sendState(client: Client, session: string, windowStart: string) {
  const sends = await rows<{ t: string }>(
    client,
    `select send_called_at as t from s5.delivery_attempt
     where session = $1 and send_called_at is not null and send_called_at > $2`,
    [session, windowStart],
  );
  const last = await rows<{ t: string | null }>(
    client,
    'select max(send_called_at) as t from s5.delivery_attempt where session = $1',
    [session],
  );
  const lastAt = last[0]?.t;
  return {
    lastSendAt: lastAt ? Date.parse(lastAt) : null,
    recent: sends.map((r) => Date.parse(r.t)),
  };
}

export async function tick(ctx: Ctx, session: string): Promise<TickResult> {
  const lock = await ctx.db.pool.connect();
  try {
    const key = `s5:${session}`;
    const got = await lock.query<{ ok: boolean }>(
      'select pg_try_advisory_lock(hashtext($1)) as ok',
      [key],
    );
    if (!got.rows[0]?.ok) return 'busy';
    try {
      return await tickLocked(ctx, session);
    } finally {
      await lock.query('select pg_advisory_unlock(hashtext($1))', [key]);
    }
  } finally {
    lock.release();
  }
}

async function tickLocked(ctx: Ctx, name: string): Promise<TickResult> {
  const { config, deps } = ctx;
  const plan = await ctx.db.tx(async (client) => {
    await sweepOrphans(ctx, client, name);
    const s = await loadSession(client, name);
    if (!s) return 'idle' as const;
    if (!sendable(s)) {
      await fallbackQueued(ctx, client, name, s.needs_admin_resume ? 'paused' : 'session_down');
      return 'idle' as const;
    }
    const head = (await rows<Head>(client, HEAD_SQL, [name]))[0];
    if (!head) return 'idle' as const;
    if (!head.confirmation && head.opted_out === true) {
      await client.query(
        "update s5.delivery_attempt set status = 'dropped', reason = 'opted_out', updated_at = $2 where id = $1",
        [head.id, ts(ctx)],
      );
      return 'progress' as const;
    }
    const typing = typingMs(head.body.length, config.pacing);
    const now = deps.now();
    const state = await sendState(client, name, ts(ctx, now - config.pacing.windowMs));
    const sendAt = nextSendAt(state, now + typing, deps.random, {
      ...config.pacing,
      timeZone: s.time_zone,
    });
    return { head, typing, sendAt, container: s.container };
  });
  if (typeof plan === 'string') return plan;

  const { head, typing, sendAt } = plan;
  const wait = sendAt - typing - deps.now();
  if (wait > config.pacing.inlineWaitMaxMs) {
    await ctx.kick(name, sendAt - typing);
    ctx.log('deferred', { session: name, seq: Number(head.seq) });
    return 'deferred';
  }
  if (wait > 0) await deps.sleep(wait);

  // Commit `sending` only if nothing changed while waiting (opt-out, breaker, outage).
  const claimed = await ctx.db.tx(async (client) => {
    const s = await loadSession(client, name, true);
    if (!s || !sendable(s)) return false;
    const fresh = (await rows<Head>(client, HEAD_SQL, [name]))[0];
    if (fresh?.id !== head.id || (!fresh.confirmation && fresh.opted_out === true)) return false;
    await client.query(
      "update s5.delivery_attempt set status = 'sending', sending_at = $2, worker = $3, updated_at = $2 where id = $1",
      [head.id, ts(ctx), String(process.pid)],
    );
    return true;
  });
  if (!claimed) return 'progress';

  return send(ctx, name, plan.container, head, typing);
}

async function send(
  ctx: Ctx,
  name: string,
  container: string,
  head: Head,
  typing: number,
): Promise<TickResult> {
  const conf = ctx.config.containers[container];
  if (!conf) throw new Error('unknown container');
  const chatId = chatOfPhone(head.phone);
  const call = (path: string, body: Record<string, unknown>) =>
    wahaCall(conf, 'POST', path, { session: name, chatId, ...body }, ctx.config.sendTimeoutMs);

  // Seen, then typing for a time that grows with the length (RN-10 pacing advice).
  let pre: WahaResult = await call('/api/sendSeen', {});
  if (pre.kind === 'ok') pre = await call('/api/startTyping', {});
  if (pre.kind === 'ok') {
    await ctx.deps.sleep(typing);
    pre = await call('/api/stopTyping', {});
  }
  let result: WahaResult = pre;
  let calledAt: number | null = null;
  if (pre.kind === 'ok') {
    calledAt = ctx.deps.now();
    result = await call('/api/sendText', { text: head.body, linkPreview: false });
  }

  return ctx.db.tx(async (client) => {
    const seq = Number(head.seq);
    if (calledAt !== null) {
      await client.query('update s5.delivery_attempt set send_called_at = $2 where id = $1', [
        head.id,
        ts(ctx, calledAt),
      ]);
    }
    const ban = result.kind === 'http' ? banCode(result.text) : null;
    if (result.kind === 'ok' && calledAt !== null) {
      const id = typeof result.json['id'] === 'string' ? result.json['id'] : null;
      const done = await client.query(
        `update s5.delivery_attempt set status = 'sent', wa_message_id = $2, sent_at = $3, updated_at = $3
         where id = $1 and status = 'sending'`,
        [head.id, id, ts(ctx)],
      );
      if (done.rowCount === 0) ctx.log('outcome_after_unknown', { session: name, seq });
      await client.query(
        'update s5.session set last_ok_at = $2, not_seen_alerted = false where name = $1',
        [name, ts(ctx)],
      );
      ctx.log('sent', { session: name, clinicId: head.clinic_id, seq });
      return 'sent';
    }
    if (ban) {
      await settleAttempt(ctx, client, head.id, 'failed', `ban_${String(ban)}`, ['sending']);
      await tripBreaker(ctx, client, name, `send_${String(ban)}`);
      return 'progress';
    }
    // Nothing reached sendText, or the connection was refused: certainly not sent.
    const notSent = calledAt === null || result.kind === 'refused';
    // A 4xx answer to sendText is a refusal; 5xx, timeouts and cut connections may have sent.
    const refusedByWaha = result.kind === 'http' && result.status < 500;
    if (notSent || refusedByWaha) {
      const reason = result.kind === 'http' ? `http_${String(result.status)}` : 'gateway_down';
      await settleAttempt(ctx, client, head.id, 'failed', reason, ['sending']);
    } else {
      await settleAttempt(ctx, client, head.id, 'unknown', result.kind, ['sending']);
    }
    ctx.log('send_failed', { session: name, seq, reason: result.kind });
    if (!refusedByWaha) await markGatewayDown(ctx, client, name);
    return 'progress';
  });
}
