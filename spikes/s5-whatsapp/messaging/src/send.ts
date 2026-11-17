// The one send interface (criterion 3, MSG-11): sendWhatsApp(clinicId, patientId, templateKey,
// vars). It validates the template, then refuses before queueing: numbers off the allowlist
// (MSG-32, dropped with a log line that has no number), patients who never wrote or opted out
// (MSG-13, MSG-14). Refusals record a reason code, never the number.
import { randomUUID } from 'node:crypto';
import { type Ctx, ts } from './context.ts';
import { type Client, rows } from './db.ts';
import { pickVariant, render, TEMPLATES, TemplateError } from './templates.ts';

export type SendResult =
  | { status: 'queued'; attemptId: string }
  | { status: 'dropped'; reason: 'allowlist' }
  | { status: 'refused'; reason: 'no_opt_in' | 'opted_out' | 'unknown_patient' | 'no_session' };

/** MSG-32: outside production only allowlisted E.164 numbers receive anything. */
export const isAllowlisted = (ctx: Ctx, phone: string) => ctx.config.allowlist.has(phone);

async function refuse(
  ctx: Ctx,
  client: Client,
  clinicId: string,
  templateKey: string,
  reason: string,
) {
  await client.query(
    'insert into s5.refusal (clinic_id, template_key, reason, created_at) values ($1, $2, $3, $4)',
    [clinicId, templateKey, reason, ts(ctx)],
  );
}

interface Target {
  phone: string;
  session: string;
}

async function target(
  client: Client,
  clinicId: string,
  patientId: string,
): Promise<Target | 'unknown_patient' | 'no_session'> {
  const patient = (
    await rows<{ phone: string }>(
      client,
      'select phone from s5.patient where clinic_id = $1 and patient_id = $2',
      [clinicId, patientId],
    )
  )[0];
  if (!patient) return 'unknown_patient';
  const session = (
    await rows<{ name: string }>(
      client,
      "select name from s5.session where clinic_id = $1 and role = 'clinic' order by name limit 1",
      [clinicId],
    )
  )[0];
  if (!session) return 'no_session';
  return { phone: patient.phone, session: session.name };
}

/**
 * Validates and queues one message in an open transaction. `confirmation` is the opt-out
 * confirmation: it skips the opt-in gate (the patient just opted out) but not the allowlist.
 * Returns the session to kick after commit.
 */
export async function enqueue(
  ctx: Ctx,
  client: Client,
  input: {
    clinicId: string;
    patientId: string;
    templateKey: string;
    vars: Record<string, string>;
    confirmation: boolean;
  },
): Promise<SendResult & { session?: string }> {
  const { clinicId, patientId, templateKey, vars, confirmation } = input;
  if (!TEMPLATES[templateKey]) throw new TemplateError('unknown template');
  const variant = pickVariant(templateKey, ctx.deps.random);
  const body = render(templateKey, variant, vars);

  const t = await target(client, clinicId, patientId);
  if (typeof t === 'string') {
    await refuse(ctx, client, clinicId, templateKey, t);
    return { status: 'refused', reason: t };
  }
  if (!isAllowlisted(ctx, t.phone)) {
    await refuse(ctx, client, clinicId, templateKey, 'allowlist');
    ctx.log('allowlist_drop', { clinicId, templateKey });
    return { status: 'dropped', reason: 'allowlist' };
  }
  if (!confirmation) {
    const optin = (
      await rows<{ last_inbound_at: string | null; opted_out: boolean }>(
        client,
        'select last_inbound_at, opted_out from s5.optin where clinic_id = $1 and patient_id = $2',
        [clinicId, patientId],
      )
    )[0];
    const reason = !optin?.last_inbound_at ? 'no_opt_in' : optin.opted_out ? 'opted_out' : null;
    if (reason) {
      await refuse(ctx, client, clinicId, templateKey, reason);
      ctx.log('send_refused', { clinicId, templateKey, reason });
      return { status: 'refused', reason };
    }
  }
  const id = randomUUID();
  const now = ts(ctx);
  const inserted = await rows<{ seq: string }>(
    client,
    `insert into s5.delivery_attempt
       (id, clinic_id, patient_id, phone, session, template_key, variant, body, confirmation, status, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'queued', $10, $10) returning seq`,
    [id, clinicId, patientId, t.phone, t.session, templateKey, variant, body, confirmation, now],
  );
  ctx.log('queued', { clinicId, templateKey, session: t.session, seq: Number(inserted[0]?.seq) });
  return { status: 'queued', attemptId: id, session: t.session };
}

export async function sendWhatsApp(
  ctx: Ctx,
  clinicId: string,
  patientId: string,
  templateKey: string,
  vars: Record<string, string>,
): Promise<SendResult> {
  const result = await ctx.db.tx((client) =>
    enqueue(ctx, client, { clinicId, patientId, templateKey, vars, confirmation: false }),
  );
  if (result.session) await ctx.kick(result.session);
  if (result.status === 'queued') return { status: 'queued', attemptId: result.attemptId };
  return result.status === 'dropped'
    ? { status: 'dropped', reason: 'allowlist' }
    : { status: 'refused', reason: result.reason };
}
