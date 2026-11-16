// Download side of the custom outbox (criterion 5): GET /sync/pull returns today's branch rows
// under withTenant(), as a snapshot (no cursor) or the rows changed since a cursor.
//
// Cursor = the pulling transaction's start time. Rows whose transaction started earlier but
// committed later carry an older updated_at, so each pull re-reads a 5-second overlap and the
// client upserts by id. A transaction longer than that could be missed (spike limit, reported).
import type { ShifaDb, Tx } from '@shifa/db';
import { type SQL, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Principal } from './auth.ts';
import type { Logger } from './log.ts';

export interface SyncDeps {
  db: ShifaDb;
  log: Logger;
  principalOf: (req: FastifyRequest) => Promise<Principal | undefined>;
}

const TZ = 'Asia/Damascus';
const OVERLAP = '5 seconds';
const Query = z.object({ cursor: z.iso.datetime({ offset: true }).optional() });

const today = sql`(now() at time zone ${TZ})::date`;
const dayStart = sql`(((now() at time zone ${TZ})::date)::timestamp at time zone ${TZ})`;

async function rowsOf(tx: Tx, query: SQL): Promise<Record<string, unknown>[]> {
  const { rows } = await tx.execute(query);
  return rows;
}

export async function pullRows(tx: Tx, p: Principal, cursor: string | undefined) {
  const since = cursor
    ? sql`and updated_at > ${cursor}::timestamptz - ${OVERLAP}::interval`
    : sql``;
  const patient = p.role === 'patient';
  const mine = patient ? sql`and patient_id = ${p.sub}` : sql``;
  const appointment = await rowsOf(
    tx,
    sql`select id, practitioner_id, patient_id, lower(slot) as start, upper(slot) as "end", status, updated_at
          from s1.appointment
         where branch_id = ${p.branchId} ${mine} ${since}
           and slot && tstzrange(${dayStart}, ${dayStart} + interval '1 day')
         order by lower(slot), id`,
  );
  const queue_ticket = await rowsOf(
    tx,
    sql`select id, practitioner_id, shift_date::text as shift_date, provisional_number,
               ${patient ? sql`null` : sql`device_id`} as device_id,
               real_number, status, walk_in_label, updated_at
          from s1.queue_ticket
         where branch_id = ${p.branchId} and shift_date = ${today} ${mine} ${since}
         order by practitioner_id, real_number`,
  );
  if (patient) return { appointment, queue_ticket, cash_session: [], cash_movement: [] };
  const cash_session = await rowsOf(
    tx,
    sql`select id, rates, closed_at, updated_at from s1.cash_session
         where branch_id = ${p.branchId} and (closed_at is null or opened_at >= ${dayStart}) ${since}
         order by opened_at, id`,
  );
  const cash_movement = await rowsOf(
    tx,
    sql`select id, session_id, type, currency, amount_minor::text as amount_minor,
               rate_used::text as rate_used, offline, refund_of, device_id, updated_at
          from s1.cash_movement
         where branch_id = ${p.branchId} and updated_at >= ${dayStart} ${since}
         order by updated_at, id`,
  );
  return { appointment, queue_ticket, cash_session, cash_movement };
}

export function registerSyncRoutes(app: FastifyInstance, deps: SyncDeps): void {
  app.get('/sync/pull', async (req, reply) => {
    const principal = await deps.principalOf(req);
    if (!principal) return reply.code(401).send({ error: 'unauthenticated' });
    const query = Query.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_cursor' });
    const ctx = {
      tenantId: principal.tenantId,
      branchId: principal.branchId,
      userId: principal.sub,
    };
    return deps.db.withTenant(ctx, async (tx) => {
      // ISO text: Drizzle hands timestamps back as strings, not Dates.
      const { rows } = await tx.execute<{ now: string }>(
        sql`select to_json(now()) #>> '{}' as now`,
      );
      const rowsByTable = await pullRows(tx, principal, query.data.cursor);
      const count = Object.values(rowsByTable).reduce((n, r) => n + r.length, 0);
      deps.log({ event: 'pull', tenantId: principal.tenantId, count });
      return { cursor: rows[0]?.now ?? new Date().toISOString(), rows: rowsByTable };
    });
  });
}
