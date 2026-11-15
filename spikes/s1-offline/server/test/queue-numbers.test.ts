// Criterion 2a, SCH-16/SCH-32: real numbers per practitioner and shift, in arrival order; a
// provisional number that differs comes back as a remap.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cmd, rowsOf, useServer } from './helpers.ts';

const server = useServer();

describe('queue numbers', () => {
  it('numbers two devices interleaved batches 1..n in arrival order, remapping clashes', async () => {
    const token = await server.login();
    const practitioner = server.ids.A.practitioners[0]?.id ?? '';
    // Both devices were offline and numbered their own tickets 1..5.
    const dev1 = [1, 2, 3, 4, 5].map((n) => cmd.issue('dev-1', practitioner, n));
    const dev2 = [1, 2, 3, 4, 5].map((n) => cmd.issue('dev-2', practitioner, n));
    const order = [dev1.slice(0, 2), dev2.slice(0, 3), dev1.slice(2), dev2.slice(3)];
    const results = [];
    for (const batch of order) results.push(...(await server.post(token, batch)).results);

    const arrival = order.flat();
    const tickets = await rowsOf<{ id: string; real_number: number; provisional_number: number }>(
      server.ids.A.tenantId,
      sql`select id, real_number, provisional_number from s1.queue_ticket
           where practitioner_id = ${practitioner} order by real_number`,
    );
    expect(tickets.map((t) => t.real_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Arrival order decides the real number.
    expect(tickets.map((t) => t.id)).toEqual(
      arrival.map((c) => (c.type === 'ticket.issue' ? c.payload.ticketId : '')),
    );
    for (const [i, result] of results.entries()) {
      const command = arrival[i];
      if (command?.type !== 'ticket.issue') throw new Error('unexpected command');
      const real = i + 1;
      expect(result.status).toBe('applied');
      if (real === command.payload.provisionalNumber) {
        expect(result.remap).toBeUndefined();
      } else {
        expect(result.remap).toEqual({
          ticketId: command.payload.ticketId,
          provisional: command.payload.provisionalNumber,
          real,
        });
      }
    }
  });

  it('numbers each practitioner separately', async () => {
    const token = await server.login();
    const second = server.ids.A.practitioners[1]?.id ?? '';
    const res = await server.post(token, [cmd.issue('dev-1', second, 7)]);
    expect(res.results[0]?.remap).toMatchObject({ provisional: 7, real: 1 });
  });

  it('applies a status change to a ticket issued earlier in the same batch', async () => {
    const token = await server.login();
    const practitioner = server.ids.A.practitioners[0]?.id ?? '';
    const issue = cmd.issue('dev-1', practitioner, 99);
    if (issue.type !== 'ticket.issue') throw new Error('unexpected command');
    const res = await server.post(token, [
      issue,
      cmd.status('dev-1', issue.payload.ticketId, 'called'),
      cmd.status('dev-1', issue.payload.ticketId, 'done'),
    ]);
    expect(res.results.map((r) => r.status)).toEqual(['applied', 'applied', 'applied']);
    const rows = await rowsOf<{ status: string }>(
      server.ids.A.tenantId,
      sql`select status from s1.queue_ticket where id = ${issue.payload.ticketId}`,
    );
    expect(rows[0]?.status).toBe('done');
  });
});
