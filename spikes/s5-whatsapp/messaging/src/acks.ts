// Acks (criterion 8, MSG-18): SERVER/DEVICE/READ/PLAYED move a delivery attempt forward only
// (sent → delivered → read); duplicates and late, older acks change nothing. ERROR fails a
// message that only reached the server (manual task), is recorded on a delivered one, and
// trips the breaker when it carries a ban code.
import { tripBreaker } from './breaker.ts';
import { type Ctx, ts } from './context.ts';
import { type Client, rows } from './db.ts';
import { settleAttempt } from './fallback.ts';
import { banCode } from './waha.ts';

const RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };
const statusOfAck = (ack: number) => (ack >= 3 ? 'read' : ack === 2 ? 'delivered' : 'sent');

export async function handleAck(
  ctx: Ctx,
  client: Client,
  session: string,
  payload: { id?: unknown; ack?: unknown; _data?: unknown },
) {
  if (typeof payload.id !== 'string' || typeof payload.ack !== 'number') return;
  const attempt = (
    await rows<{ id: string; seq: string; status: string; clinic_id: string }>(
      client,
      'select id, seq, status, clinic_id from s5.delivery_attempt where wa_message_id = $1 and session = $2 for update',
      [payload.id, session],
    )
  )[0];
  if (!attempt) return;
  const seq = Number(attempt.seq);

  if (payload.ack === -1) {
    const code = banCode(JSON.stringify(payload._data ?? {}));
    const errorCode = code ? `ban_${String(code)}` : 'ack_error';
    if (attempt.status === 'sent') {
      await client.query('update s5.delivery_attempt set error_code = $2 where id = $1', [
        attempt.id,
        errorCode,
      ]);
      await settleAttempt(ctx, client, attempt.id, 'failed', errorCode, ['sent']);
    } else if (attempt.status === 'delivered' || attempt.status === 'read') {
      await client.query(
        'update s5.delivery_attempt set error_code = $2, updated_at = $3 where id = $1',
        [attempt.id, errorCode, ts(ctx)],
      );
    }
    ctx.log('ack_error', { session, clinicId: attempt.clinic_id, seq, reason: errorCode });
    if (code) await tripBreaker(ctx, client, session, `ack_${String(code)}`);
    return;
  }
  if (payload.ack < 1) return;
  const next = statusOfAck(payload.ack);
  const current = RANK[attempt.status];
  if (current === undefined || (RANK[next] ?? 0) <= current) return;
  await client.query('update s5.delivery_attempt set status = $2, updated_at = $3 where id = $1', [
    attempt.id,
    next,
    ts(ctx),
  ]);
  ctx.log('ack', { session, seq, status: next });
}
