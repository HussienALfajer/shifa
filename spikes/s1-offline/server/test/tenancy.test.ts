// Criterion 10, server half: ids of tenant B sent with tenant A's token are refused, nothing is
// written, and the log carries ids and a code only. Every `s1` table is under FORCE RLS.
import { randomUUID } from 'node:crypto';
import { ownerDb } from '@shifa/db/testing';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cmd, rowsOf, TODAY, useServer } from './helpers.ts';

const server = useServer();

describe('tenant scoping of commands', () => {
  it('refuses commands that name tenant B rows from a tenant A token, logging ids only', async () => {
    const tokenA = await server.login('A');
    const tokenB = await server.login('B');
    const sessionB = randomUUID();
    const bookB = cmd.book(
      server.ids.B.practitioners[0]?.id ?? '',
      `${TODAY}T09:00:00+03:00`,
      `${TODAY}T09:30:00+03:00`,
    );
    if (bookB.type !== 'appointment.book') throw new Error('unexpected command');
    const issueB = cmd.issue('dev-b', server.ids.B.practitioners[0]?.id ?? '', 1);
    if (issueB.type !== 'ticket.issue') throw new Error('unexpected command');
    await server.post(tokenB, [cmd.open(sessionB), bookB, issueB]);

    server.logs.length = 0;
    const forged = [
      cmd.issue('dev-a', server.ids.B.practitioners[0]?.id ?? '', 1),
      cmd.status('dev-a', issueB.payload.ticketId, 'done'),
      cmd.cancel(bookB.payload.appointmentId),
      cmd.move(sessionB, 'sale', 'SYP', 1_000n),
      cmd.book(
        server.ids.B.practitioners[0]?.id ?? '',
        `${TODAY}T11:00:00+03:00`,
        `${TODAY}T11:30:00+03:00`,
      ),
    ];
    const res = await server.post(tokenA, forged);
    expect(res.results.map((r) => r.status)).toEqual(Array(forged.length).fill('refused'));

    // Tenant B's rows are unchanged; tenant A has nothing.
    const b = await rowsOf<{ t: string; a: string; m: number }>(
      server.ids.B.tenantId,
      sql`select (select status from s1.queue_ticket where id = ${issueB.payload.ticketId}) as t,
                 (select status from s1.appointment where id = ${bookB.payload.appointmentId}) as a,
                 (select count(*)::int from s1.cash_movement) as m`,
    );
    expect(b[0]).toEqual({ t: 'waiting', a: 'booked', m: 0 });
    const a = await rowsOf<{ n: number }>(
      server.ids.A.tenantId,
      sql`select (select count(*) from s1.queue_ticket) + (select count(*) from s1.appointment)
                 + (select count(*) from s1.cash_movement) as n`,
    );
    expect(Number(a[0]?.n)).toBe(0);

    const refusals = server.logs.filter((l) => l['event'] === 'command_refused');
    expect(refusals).toHaveLength(forged.length);
    for (const line of refusals) {
      expect(Object.keys(line).sort()).toEqual(['code', 'commandId', 'event', 'tenantId']);
    }
    const text = JSON.stringify(server.logs);
    expect(text).not.toContain(tokenA);
    expect(text).not.toContain('مراجع');
  });
});

describe('s1 catalog', () => {
  it('has tenant_id, ENABLE + FORCE RLS and a current_tenant_id() policy on every table', async () => {
    const { rows } = await ownerDb().execute<{
      table: string;
      rls: boolean;
      forced: boolean;
      has_tenant: boolean;
      policies: number;
    }>(sql`
      select c.relname as table, c.relrowsecurity as rls, c.relforcerowsecurity as forced,
             exists (select 1 from pg_attribute a where a.attrelid = c.oid
                       and a.attname = 'tenant_id' and not a.attisdropped) as has_tenant,
             (select count(*)::int from pg_policy p where p.polrelid = c.oid
                and pg_get_expr(p.polqual, p.polrelid) like '%current_tenant_id()%'
                and pg_get_expr(p.polwithcheck, p.polrelid) like '%current_tenant_id()%') as policies
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 's1' and c.relkind = 'r' order by 1`);
    expect(rows.map((r) => r.table)).toEqual([
      'appointment',
      'cash_movement',
      'cash_session',
      'offline_command',
      'practitioner',
      'queue_ticket',
    ]);
    for (const row of rows)
      expect(row).toMatchObject({ rls: true, forced: true, has_tenant: true, policies: 1 });
  });
});
