// The three conflict rules and the offline cash rules (spec criteria 2, 3). Each rule runs in the
// command's withTenant() transaction; ids of another tenant are invisible under RLS, so a forged
// reference reads as "unknown" and is refused. Rules throw Refusal to refuse.
import type { Tx } from '@shifa/db';
import { sql } from 'drizzle-orm';
import type { Principal } from '../auth.ts';
import { type Command, OFFLINE_MOVEMENT_TYPES, type Payload } from '../commands.ts';
import { Refusal } from './messages.ts';

export interface Applied {
  remap?: { ticketId: string; provisional: number; real: number };
}

interface RuleContext {
  tx: Tx;
  principal: Principal;
  command: Command;
}

async function exists(tx: Tx, query: ReturnType<typeof sql>): Promise<boolean> {
  const { rows } = await tx.execute(query);
  return rows.length > 0;
}

async function assertPractitioner(ctx: RuleContext, practitionerId: string): Promise<void> {
  const ok = await exists(
    ctx.tx,
    sql`select 1 from s1.practitioner where id = ${practitionerId} and branch_id = ${ctx.principal.branchId}`,
  );
  if (!ok) throw new Refusal('unknown_reference');
}

async function issueTicket(ctx: RuleContext, p: Payload<'ticket.issue'>): Promise<Applied> {
  await assertPractitioner(ctx, p.practitionerId);
  if (await exists(ctx.tx, sql`select 1 from s1.queue_ticket where id = ${p.ticketId}`)) {
    throw new Refusal('duplicate_id');
  }
  const branch = ctx.principal.branchId;
  // SCH-16: real numbers in arrival order, max + 1 under a lock on the shift (no counter table).
  const shiftKey = `s1q:${ctx.principal.tenantId}:${branch}:${p.practitionerId}:${p.shiftDate}`;
  await ctx.tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${shiftKey}, 0))`);
  const { rows } = await ctx.tx.execute<{ real: number }>(
    sql`select coalesce(max(real_number), 0)::int + 1 as real from s1.queue_ticket
         where branch_id = ${branch} and practitioner_id = ${p.practitionerId}
           and shift_date = ${p.shiftDate}`,
  );
  const real = rows[0]?.real ?? 1;
  await ctx.tx.execute(
    sql`insert into s1.queue_ticket (id, branch_id, practitioner_id, shift_date, provisional_number,
                                     device_id, real_number, walk_in_label)
        values (${p.ticketId}, ${branch}, ${p.practitionerId}, ${p.shiftDate}, ${p.provisionalNumber},
                ${ctx.command.deviceId}, ${real}, ${p.walkInLabel})`,
  );
  return real === p.provisionalNumber
    ? {}
    : { remap: { ticketId: p.ticketId, provisional: p.provisionalNumber, real } };
}

async function ticketStatus(ctx: RuleContext, p: Payload<'ticket.status'>): Promise<Applied> {
  const { rowCount } = await ctx.tx.execute(
    sql`update s1.queue_ticket set status = ${p.status}, updated_at = clock_timestamp()
         where id = ${p.ticketId} and branch_id = ${ctx.principal.branchId}`,
  );
  if (!rowCount) throw new Refusal('unknown_reference');
  return {};
}

async function book(ctx: RuleContext, p: Payload<'appointment.book'>): Promise<Applied> {
  if (Date.parse(p.end) <= Date.parse(p.start)) throw new Refusal('invalid_slot');
  await assertPractitioner(ctx, p.practitionerId);
  if (await exists(ctx.tx, sql`select 1 from s1.appointment where id = ${p.appointmentId}`)) {
    throw new Refusal('duplicate_id');
  }
  // An overlap raises 23P01 (exclusion constraint); the handler stores it as a conflict.
  await ctx.tx.execute(
    sql`insert into s1.appointment (id, branch_id, practitioner_id, patient_id, slot)
        values (${p.appointmentId}, ${ctx.principal.branchId}, ${p.practitionerId},
                ${p.patientId ?? null}, tstzrange(${p.start}::timestamptz, ${p.end}::timestamptz, '[)'))`,
  );
  return {};
}

async function cancel(ctx: RuleContext, p: Payload<'appointment.cancel'>): Promise<Applied> {
  // A patient may cancel only their own appointment.
  const own = ctx.principal.role === 'patient' ? sql`and patient_id = ${ctx.principal.sub}` : sql``;
  const { rowCount } = await ctx.tx.execute(
    sql`update s1.appointment set status = 'cancelled', updated_at = clock_timestamp()
         where id = ${p.appointmentId} and branch_id = ${ctx.principal.branchId} ${own}`,
  );
  if (!rowCount) throw new Refusal('unknown_reference');
  return {};
}

async function openSession(ctx: RuleContext, p: Payload<'cash.open'>): Promise<Applied> {
  if (ctx.command.offline) throw new Refusal('offline_cash_open');
  if (await exists(ctx.tx, sql`select 1 from s1.cash_session where id = ${p.sessionId}`)) {
    throw new Refusal('duplicate_id');
  }
  await ctx.tx.execute(
    sql`insert into s1.cash_session (id, branch_id, rates)
        values (${p.sessionId}, ${ctx.principal.branchId}, ${JSON.stringify(p.rates)}::jsonb)`,
  );
  return {};
}

async function closeSession(ctx: RuleContext, p: Payload<'cash.close'>): Promise<Applied> {
  if (ctx.command.offline) throw new Refusal('offline_cash_close');
  const { rowCount } = await ctx.tx.execute(
    sql`update s1.cash_session set closed_at = clock_timestamp(), updated_at = clock_timestamp()
         where id = ${p.sessionId} and branch_id = ${ctx.principal.branchId} and closed_at is null`,
  );
  if (!rowCount) throw new Refusal('session_closed');
  return {};
}

async function assertRefundable(ctx: RuleContext, p: Payload<'cash.move'>): Promise<void> {
  if (p.type !== 'refund') {
    if (p.refundOf) throw new Refusal('refund_without_sale');
    return;
  }
  if (!p.refundOf) throw new Refusal('refund_without_sale');
  // Serialise refunds of one sale so two devices cannot both refund the remainder.
  await ctx.tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`s1r:${ctx.principal.tenantId}:${p.refundOf}`}, 0))`,
  );
  const { rows } = await ctx.tx.execute<{ remaining: string }>(
    sql`select (s.amount_minor - coalesce((select sum(r.amount_minor) from s1.cash_movement r
                                            where r.refund_of = s.id), 0))::text as remaining
          from s1.cash_movement s
         where s.id = ${p.refundOf} and s.type = 'sale' and s.currency = ${p.currency}
           and s.branch_id = ${ctx.principal.branchId}`,
  );
  const remaining = rows[0]?.remaining;
  if (remaining === undefined) throw new Refusal('refund_without_sale');
  if (BigInt(p.amountMinor) > BigInt(remaining)) throw new Refusal('refund_exceeds_sale');
}

async function move(ctx: RuleContext, p: Payload<'cash.move'>): Promise<Applied> {
  const { rows } = await ctx.tx.execute<{ open: boolean; rate_matches: boolean }>(
    sql`select closed_at is null as open,
               coalesce((rates ->> ${p.currency})::numeric = ${p.rateUsed}::numeric, false) as rate_matches
          from s1.cash_session where id = ${p.sessionId} and branch_id = ${ctx.principal.branchId}`,
  );
  const session = rows[0];
  if (!session?.open) throw new Refusal('session_closed');
  if (ctx.command.offline) {
    // OD-29: offline only sales and refunds, at the session's (last synced) rate.
    if (!OFFLINE_MOVEMENT_TYPES.includes(p.type)) throw new Refusal('offline_cash_type');
    if (!session.rate_matches) throw new Refusal('offline_rate');
  }
  if (await exists(ctx.tx, sql`select 1 from s1.cash_movement where id = ${p.movementId}`)) {
    throw new Refusal('duplicate_id');
  }
  await assertRefundable(ctx, p);
  await ctx.tx.execute(
    sql`insert into s1.cash_movement (id, branch_id, session_id, type, currency, amount_minor,
                                      rate_used, offline, refund_of, device_id)
        values (${p.movementId}, ${ctx.principal.branchId}, ${p.sessionId}, ${p.type}, ${p.currency},
                ${p.amountMinor}::bigint, ${p.rateUsed}::numeric, ${ctx.command.offline},
                ${p.refundOf ?? null}, ${ctx.command.deviceId})`,
  );
  return {};
}

/** Applies one validated command; throws Refusal, or a database error (23P01 for overlaps). */
export function applyRule(tx: Tx, principal: Principal, command: Command): Promise<Applied> {
  const ctx: RuleContext = { tx, principal, command };
  if (principal.role === 'patient' && command.type !== 'appointment.cancel') {
    throw new Refusal('forbidden');
  }
  switch (command.type) {
    case 'ticket.issue':
      return issueTicket(ctx, command.payload);
    case 'ticket.status':
      return ticketStatus(ctx, command.payload);
    case 'appointment.book':
      return book(ctx, command.payload);
    case 'appointment.cancel':
      return cancel(ctx, command.payload);
    case 'cash.open':
      return openSession(ctx, command.payload);
    case 'cash.close':
      return closeSession(ctx, command.payload);
    case 'cash.move':
      return move(ctx, command.payload);
  }
}
