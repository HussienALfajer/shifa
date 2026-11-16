// Slice 0.3-S1e: a patient's ticket is issued through the one command handler (`ticket.issue`
// with `patientId`), reaches that patient's pull only, and a patient token cannot issue tickets.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cmd, rowsOf, useServer } from './helpers.ts';

const server = useServer();

async function patientToken(patientId: string): Promise<string> {
  const res = await server.app.inject({
    method: 'POST',
    url: '/auth/patient-login',
    body: { patientId },
  });
  return res.json<{ token: string }>().token;
}

async function pulledTickets(token: string): Promise<string[]> {
  const res = await server.app.inject({
    method: 'GET',
    url: '/sync/pull',
    headers: { authorization: `Bearer ${token}` },
  });
  return res
    .json<{ rows: { queue_ticket: { id: string }[] } }>()
    .rows.queue_ticket.map((t) => t.id);
}

describe('patient tickets', () => {
  it('stores patientId on ticket.issue and syncs the ticket to that patient only', async () => {
    const reception = await server.login('A');
    const [first, second] = server.ids.A.patients;
    const practitioner = server.ids.A.practitioners[2]?.id ?? '';
    const issue = cmd.issue('dev-1', practitioner, 1);
    if (issue.type !== 'ticket.issue') throw new Error('unexpected command');
    const withPatient = { ...issue, payload: { ...issue.payload, patientId: first?.id } };
    const res = await server.post(reception, [withPatient]);
    expect(res.results[0]?.status).toBe('applied');

    const rows = await rowsOf<{ patient_id: string | null }>(
      server.ids.A.tenantId,
      sql`select patient_id from s1.queue_ticket where id = ${issue.payload.ticketId}`,
    );
    expect(rows).toEqual([{ patient_id: first?.id }]);
    expect(await pulledTickets(await patientToken(first?.id ?? ''))).toEqual([
      issue.payload.ticketId,
    ]);
    expect(await pulledTickets(await patientToken(second?.id ?? ''))).toEqual([]);
  });

  it('refuses a ticket issued with a patient token', async () => {
    const patient = server.ids.A.patients[0]?.id ?? '';
    const practitioner = server.ids.A.practitioners[2]?.id ?? '';
    const issue = cmd.issue('dev-1', practitioner, 2);
    if (issue.type !== 'ticket.issue') throw new Error('unexpected command');
    const own = { ...issue, payload: { ...issue.payload, patientId: patient } };
    const res = await server.post(await patientToken(patient), [own]);
    expect(res.results.map((r) => r.status)).toEqual(['refused']);
    const rows = await rowsOf(
      server.ids.A.tenantId,
      sql`select 1 from s1.queue_ticket where id = ${issue.payload.ticketId}`,
    );
    expect(rows).toEqual([]);
  });
});
