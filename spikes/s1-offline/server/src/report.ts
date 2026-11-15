// GET /report?devices=a,b — counts only, for the scenario suite and the owner's manual run:
// commands received per device and outcome, real numbers per shift (duplicates and gaps), cash
// totals per currency. Never row values or names.
import type { Tx } from '@shifa/db';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SyncDeps } from './sync.ts';

const Query = z.object({
  devices: z.string().regex(/^[A-Za-z0-9-]{1,40}(,[A-Za-z0-9-]{1,40}){0,9}$/),
});

export interface Report {
  byDevice: Record<
    string,
    { commands: number; applied: number; conflict: number; refused: number; remaps: number }
  >;
  tickets: { total: number; duplicateNumbers: number; gaps: number; shifts: number };
  movements: number;
  cash: Record<string, string>;
  appointmentsBooked: number;
}

async function build(tx: Tx, devices: string[]): Promise<Report> {
  const list = sql.join(
    devices.map((d) => sql`${d}`),
    sql`, `,
  );
  const { rows: commands } = await tx.execute<{
    device_id: string;
    status: string;
    n: number;
    remaps: number;
  }>(sql`select device_id, result ->> 'status' as status, count(*)::int as n,
                count(*) filter (where result ? 'remap')::int as remaps
           from s1.offline_command where device_id in (${list}) group by 1, 2`);
  const byDevice: Report['byDevice'] = {};
  for (const d of devices)
    byDevice[d] = { commands: 0, applied: 0, conflict: 0, refused: 0, remaps: 0 };
  for (const r of commands) {
    const entry = byDevice[r.device_id];
    if (!entry) continue;
    entry.commands += r.n;
    entry.remaps += r.remaps;
    if (r.status === 'applied' || r.status === 'conflict' || r.status === 'refused')
      entry[r.status] += r.n;
  }
  const { rows: shifts } = await tx.execute<{ n: number; distinct_n: number; max_n: number }>(
    sql`select count(*)::int as n, count(distinct real_number)::int as distinct_n,
               max(real_number)::int as max_n
          from s1.queue_ticket t
         where exists (select 1 from s1.queue_ticket d where d.device_id in (${list})
                         and d.practitioner_id = t.practitioner_id and d.shift_date = t.shift_date)
         group by practitioner_id, shift_date`,
  );
  const { rows: ticketCount } = await tx.execute<{ n: number }>(
    sql`select count(*)::int as n from s1.queue_ticket where device_id in (${list})`,
  );
  const { rows: cash } = await tx.execute<{ currency: string; total: string; n: number }>(
    sql`select currency, sum(case when type in ('sale', 'deposit') then amount_minor else -amount_minor end)::text
                 as total, count(*)::int as n
          from s1.cash_movement where device_id in (${list}) group by currency order by currency`,
  );
  const { rows: booked } = await tx.execute<{ n: number }>(
    sql`select count(*)::int as n from s1.offline_command
         where device_id in (${list}) and type = 'appointment.book' and result ->> 'status' = 'applied'`,
  );
  return {
    byDevice,
    tickets: {
      total: ticketCount[0]?.n ?? 0,
      duplicateNumbers: shifts.reduce((s, r) => s + r.n - r.distinct_n, 0),
      gaps: shifts.reduce((s, r) => s + r.max_n - r.distinct_n, 0),
      shifts: shifts.length,
    },
    movements: cash.reduce((s, r) => s + r.n, 0),
    cash: Object.fromEntries(cash.map((r) => [r.currency, r.total])),
    appointmentsBooked: booked[0]?.n ?? 0,
  };
}

export function registerReportRoute(app: FastifyInstance, deps: SyncDeps): void {
  app.get('/report', async (req, reply) => {
    const principal = await deps.principalOf(req);
    if (principal?.role !== 'reception') return reply.code(401).send({ error: 'unauthenticated' });
    const query = Query.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_devices' });
    const ctx = {
      tenantId: principal.tenantId,
      branchId: principal.branchId,
      userId: principal.sub,
    };
    return deps.db.withTenant(ctx, (tx) => build(tx, query.data.devices.split(',')));
  });
}
