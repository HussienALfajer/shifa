// Inbound messages (criterion 4, MSG-13, MSG-14): any message, edit, revoke or reaction from a
// known patient records the last inbound time; the stop keyword (plain messages only) opts out
// at once, drops queued messages and queues one confirmation; a later inbound opts back in.
// State changes apply only when the message is newer than the stored state, so a late, older
// message cannot undo an opt-out (ties go to the opt-out).
import { type Ctx, type SessionRow, ts } from './context.ts';
import { type Client, rows } from './db.ts';
import { isOptOutKeyword } from './keywords.ts';
import { enqueue } from './send.ts';

export interface Inbound {
  /** Resolved phone in E.164. */
  phone: string;
  /** Unix seconds of the message (or of the event when the payload has none). */
  timestamp: number;
  /** Text of a plain message; null for edits, revokes and reactions (never a keyword). */
  keywordText: string | null;
}

/** Returns the session to kick after commit when a confirmation was queued. */
export async function recordInbound(
  ctx: Ctx,
  client: Client,
  session: SessionRow,
  inbound: Inbound,
): Promise<string | undefined> {
  // An inbound message proves the linked phone is online (MSG-17 "phone not seen").
  await client.query(
    'update s5.session set last_ok_at = greatest(last_ok_at, $2), not_seen_alerted = false where name = $1',
    [session.name, ts(ctx)],
  );
  // Platform-session traffic (reverse verification) is 0.3-S5b; it never touches clinic opt-in.
  if (session.role !== 'clinic' || !session.clinic_id) return undefined;
  const clinicId = session.clinic_id;
  const patient = (
    await rows<{ patient_id: string }>(
      client,
      'select patient_id from s5.patient where clinic_id = $1 and phone = $2',
      [clinicId, inbound.phone],
    )
  )[0];
  if (!patient) {
    ctx.log('inbound_unknown_sender', { session: session.name, clinicId });
    return undefined;
  }
  const patientId = patient.patient_id;
  const at = new Date(inbound.timestamp * 1000).toISOString();
  await client.query(
    `insert into s5.optin (clinic_id, patient_id, last_inbound_at, opted_out, state_at)
     values ($1, $2, null, false, to_timestamp(0)) on conflict do nothing`,
    [clinicId, patientId],
  );
  const current = (
    await rows<{ opted_out: boolean; state_at: string }>(
      client,
      'select opted_out, state_at from s5.optin where clinic_id = $1 and patient_id = $2 for update',
      [clinicId, patientId],
    )
  )[0];
  if (!current) return undefined;
  const stateAt = Date.parse(current.state_at);
  const msgAt = inbound.timestamp * 1000;
  await client.query(
    `update s5.optin set last_inbound_at = greatest(coalesce(last_inbound_at, $3), $3)
     where clinic_id = $1 and patient_id = $2`,
    [clinicId, patientId, at],
  );

  const keyword = inbound.keywordText !== null && isOptOutKeyword(inbound.keywordText);
  if (keyword && msgAt >= stateAt) {
    await client.query(
      'update s5.optin set opted_out = true, state_at = $3 where clinic_id = $1 and patient_id = $2',
      [clinicId, patientId, at],
    );
    if (current.opted_out) return undefined;
    const dropped = await client.query(
      `update s5.delivery_attempt set status = 'dropped', reason = 'opted_out', updated_at = $3
       where clinic_id = $1 and patient_id = $2 and status = 'queued' and not confirmation`,
      [clinicId, patientId, ts(ctx)],
    );
    ctx.log('opted_out', { clinicId, patientId, status: dropped.rowCount ?? 0 });
    const confirmation = await enqueue(ctx, client, {
      clinicId,
      patientId,
      templateKey: 'optout_confirmation',
      vars: {},
      confirmation: true,
    });
    return confirmation.session;
  }
  if (!keyword && msgAt > stateAt) {
    await client.query(
      'update s5.optin set opted_out = false, state_at = $3 where clinic_id = $1 and patient_id = $2',
      [clinicId, patientId, at],
    );
    if (current.opted_out) ctx.log('opted_in_again', { clinicId, patientId });
  }
  return undefined;
}
