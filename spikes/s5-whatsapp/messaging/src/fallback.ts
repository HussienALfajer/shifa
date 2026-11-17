// The fallback ladder (MSG-01, MSG-02, MSG-16): a message that cannot go out on WhatsApp
// becomes an inbox record (stand-in for the in-app inbox) and a reception "send manually" task
// with a prefilled wa.me link; a send whose outcome is unknown is marked "maybe sent".
// Alerts to the clinic admin are raised once per state transition.
import { type Ctx, deriveHealth, loadSession, ts } from './context.ts';
import { type Client, rows } from './db.ts';

interface AttemptRow {
  id: string;
  seq: string;
  clinic_id: string;
  patient_id: string;
  body: string;
  /** The number the message was queued for (the one that opted in). */
  phone: string;
}

/** Moves the given attempts (already in their final status) to inbox + manual task. */
async function addFallback(ctx: Ctx, client: Client, attempts: AttemptRow[], maybeSent: boolean) {
  for (const a of attempts) {
    const link = `https://wa.me/${a.phone.replace(/^\+/, '')}?text=${encodeURIComponent(a.body)}`;
    await client.query(
      `insert into s5.inbox (clinic_id, patient_id, attempt_id, created_at) values ($1, $2, $3, $4)
       on conflict (attempt_id) do nothing`,
      [a.clinic_id, a.patient_id, a.id, ts(ctx)],
    );
    await client.query(
      `insert into s5.manual_task (clinic_id, patient_id, attempt_id, link, maybe_sent, created_at)
       values ($1, $2, $3, $4, $5, $6) on conflict (attempt_id) do nothing`,
      [a.clinic_id, a.patient_id, a.id, link, maybeSent, ts(ctx)],
    );
    ctx.log('fallback', {
      clinicId: a.clinic_id,
      seq: Number(a.seq),
      reason: maybeSent ? 'maybe_sent' : 'not_sent',
    });
  }
}

/** Every queued message of the session goes to the fallback. */
export async function fallbackQueued(ctx: Ctx, client: Client, session: string, reason: string) {
  const moved = await rows<AttemptRow>(
    client,
    `update s5.delivery_attempt set status = 'fallback', reason = $2, updated_at = $3
     where session = $1 and status = 'queued'
     returning id, seq, clinic_id, patient_id, body, phone`,
    [session, reason, ts(ctx)],
  );
  moved.sort((a, b) => Number(a.seq) - Number(b.seq));
  await addFallback(ctx, client, moved, false);
}

/** One attempt ends as failed (not sent) or unknown (maybe sent), with its manual task. */
export async function settleAttempt(
  ctx: Ctx,
  client: Client,
  id: string,
  outcome: 'failed' | 'unknown',
  reason: string,
  fromStatuses: string[],
) {
  const settled = await rows<AttemptRow>(
    client,
    `update s5.delivery_attempt set status = $2, reason = $3, updated_at = $4
     where id = $1 and status = any($5) returning id, seq, clinic_id, patient_id, body, phone`,
    [id, outcome, reason, ts(ctx), fromStatuses],
  );
  await addFallback(ctx, client, settled, outcome === 'unknown');
  return settled.length > 0;
}

export async function alert(
  ctx: Ctx,
  client: Client,
  session: string,
  clinicId: string | null,
  kind: string,
) {
  await client.query(
    'insert into s5.admin_alert (clinic_id, session, kind, created_at) values ($1, $2, $3, $4)',
    [clinicId, session, kind, ts(ctx)],
  );
  ctx.log('admin_alert', { session, clinicId, reason: kind });
}

/** Recomputes the clinic-visible state; alerts once when it turns needs_qr or down. */
export async function refreshHealth(ctx: Ctx, client: Client, name: string) {
  const s = await loadSession(client, name, true);
  if (!s) return;
  const health = deriveHealth(s);
  if (health === s.health) return;
  await client.query('update s5.session set health = $2 where name = $1', [name, health]);
  if (health === 'needs_qr' || health === 'down')
    await alert(ctx, client, name, s.clinic_id, `health:${health}`);
}

/** Gateway unreachable or a send timed out: fallback, no 24 h pause (OD-46). */
export async function markGatewayDown(ctx: Ctx, client: Client, name: string) {
  await client.query('update s5.session set gateway_down = true where name = $1', [name]);
  await fallbackQueued(ctx, client, name, 'gateway_down');
  await refreshHealth(ctx, client, name);
}

/**
 * WAHA's session status changed (webhook or health job). Anything but WORKING sends pending
 * messages to the fallback; WORKING clears "gateway down" and lets sending resume.
 */
export async function setWahaStatus(
  ctx: Ctx,
  client: Client,
  name: string,
  status: string,
  reachable: boolean,
) {
  const s = await loadSession(client, name, true);
  if (!s) return;
  const clearDown = reachable && status === 'WORKING';
  await client.query(
    'update s5.session set waha_status = $2, gateway_down = case when $3 then false else gateway_down end where name = $1',
    [name, status, clearDown],
  );
  if (status !== 'WORKING' && status !== 'STARTING')
    await fallbackQueued(ctx, client, name, `status_${status.toLowerCase()}`);
  await refreshHealth(ctx, client, name);
  if (clearDown && (s.gateway_down || s.waha_status !== 'WORKING')) {
    ctx.log('session_resumed', { session: name });
  }
}
