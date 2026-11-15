// Criteria 5 and 10 (outbox half): GET /sync/pull returns a snapshot, then changes since a
// cursor, only for the token's tenant, branch and today; a patient gets their own rows only.
import { randomUUID } from 'node:crypto';
import { testDb } from '@shifa/db/testing';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cmd, TODAY, useServer } from './helpers.ts';

const server = useServer();

interface Pull {
  cursor: string;
  rows: {
    appointment: { id: string; status: string; patient_id: string | null }[];
    queue_ticket: { id: string; status: string; real_number: number; provisional_number: number }[];
    cash_session: { id: string; rates: Record<string, string> }[];
    cash_movement: { id: string; amount_minor: string }[];
  };
}

async function pull(token: string, cursor?: string) {
  const res = await server.app.inject({
    method: 'GET',
    url: `/sync/pull${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: res.statusCode, body: res.statusCode === 200 ? res.json<Pull>() : undefined };
}

const ids = (rows: { id: string }[] | undefined) => (rows ?? []).map((r) => r.id);
const at = (hhmm: string) => `${TODAY}T${hhmm}:00+03:00`;

describe('pull', () => {
  it('returns a snapshot, then changes since the cursor', async () => {
    const token = await server.login('A');
    const practitioner = server.ids.A.practitioners[0]?.id ?? '';
    const issue = cmd.issue('dev-1', practitioner, 1);
    if (issue.type !== 'ticket.issue') throw new Error('unexpected command');
    const session = randomUUID();
    const sale = cmd.move(session, 'sale', 'USD', 1_000n);
    await server.post(token, [issue, cmd.open(session), sale]);

    const first = await pull(token);
    expect(first.status).toBe(200);
    const ticket = first.body?.rows.queue_ticket.find((t) => t.id === issue.payload.ticketId);
    expect(ticket).toMatchObject({ status: 'waiting', real_number: 1, provisional_number: 1 });
    expect(ids(first.body?.rows.cash_session)).toContain(session);
    expect(first.body?.rows.cash_session[0]?.rates).toMatchObject({ USD: '1' });
    expect(first.body?.rows.cash_movement[0]?.amount_minor).toBe('1000');

    await server.post(token, [cmd.status('dev-1', issue.payload.ticketId, 'called')]);
    const second = await pull(token, first.body?.cursor);
    const changed = second.body?.rows.queue_ticket.find((t) => t.id === issue.payload.ticketId);
    expect(changed?.status).toBe('called');
  });

  it('never returns tenant B rows to tenant A', async () => {
    const tokenB = await server.login('B');
    const bookB = cmd.book(server.ids.B.practitioners[0]?.id ?? '', at('08:00'), at('08:30'));
    const issueB = cmd.issue('dev-b', server.ids.B.practitioners[0]?.id ?? '', 1);
    await server.post(tokenB, [bookB, issueB]);
    const fromB = await pull(tokenB);
    expect(fromB.body?.rows.appointment.length).toBeGreaterThan(0);

    const fromA = await pull(await server.login('A'));
    const all = Object.values(fromA.body?.rows ?? {}).flatMap((rows: { id: string }[]) =>
      ids(rows),
    );
    for (const id of [
      ...ids(fromB.body?.rows.appointment),
      ...ids(fromB.body?.rows.queue_ticket),
    ]) {
      expect(all).not.toContain(id);
    }
  });

  it('keeps to the token branch and today', async () => {
    const otherBranch = randomUUID();
    const otherPractitioner = randomUUID();
    const yesterdayTicket = randomUUID();
    const otherBranchTicket = randomUUID();
    const a = server.ids.A;
    const practitioner = a.practitioners[0]?.id ?? '';
    await testDb().withTenant({ tenantId: a.tenantId, userId: randomUUID() }, async (tx) => {
      await tx.execute(
        sql`insert into s1.practitioner (id, branch_id, label) values (${otherPractitioner}, ${otherBranch}, 'x')`,
      );
      await tx.execute(
        sql`insert into s1.queue_ticket (id, branch_id, practitioner_id, shift_date, provisional_number,
                                         device_id, real_number, walk_in_label)
            values (${otherBranchTicket}, ${otherBranch}, ${otherPractitioner}, ${TODAY}, 1, 'd', 1, 'x'),
                   (${yesterdayTicket}, ${a.branchId}, ${practitioner},
                    ${TODAY}::date - 1, 1, 'd', 1, 'x')`,
      );
    });
    const res = await pull(await server.login('A'));
    expect(ids(res.body?.rows.queue_ticket)).not.toContain(otherBranchTicket);
    expect(ids(res.body?.rows.queue_ticket)).not.toContain(yesterdayTicket);
  });

  it('gives a patient only their own appointments and no cash', async () => {
    const reception = await server.login('A');
    const patient = server.ids.A.patients[0]?.id ?? '';
    const practitioner = server.ids.A.practitioners[1]?.id ?? '';
    const mine = cmd.book(practitioner, at('15:00'), at('15:30'));
    if (mine.type !== 'appointment.book') throw new Error('unexpected command');
    mine.payload.patientId = patient;
    await server.post(reception, [mine, cmd.book(practitioner, at('16:00'), at('16:30'))]);
    const login = await server.app.inject({
      method: 'POST',
      url: '/auth/patient-login',
      body: { patientId: patient },
    });
    const res = await pull(login.json<{ token: string }>().token);
    expect(res.status).toBe(200);
    expect(res.body?.rows.appointment.map((r) => r.patient_id)).toEqual([patient]);
    expect(res.body?.rows.cash_movement).toEqual([]);
    expect(res.body?.rows.cash_session).toEqual([]);
  });

  it('rejects a pull without a valid token', async () => {
    expect((await pull('not-a-token')).status).toBe(401);
  });
});
