// Criterion 2b, SCH-14: an overlapping booking comes back as a conflict, never dropped silently.
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { cmd, rowsOf, TODAY, useServer } from './helpers.ts';

const server = useServer();
const at = (hhmm: string) => `${TODAY}T${hhmm}:00+03:00`;

describe('appointments', () => {
  it('returns an overlapping booking as a conflict with an Arabic message and stores no row', async () => {
    const token = await server.login();
    const practitioner = server.ids.A.practitioners[0]?.id ?? '';
    const first = cmd.book(practitioner, at('10:00'), at('10:30'));
    const overlap = cmd.book(practitioner, at('10:15'), at('10:45'));
    const res = await server.post(token, [first, overlap]);
    expect(res.results[0]?.status).toBe('applied');
    expect(res.results[1]?.status).toBe('conflict');
    expect(res.results[1]?.conflict?.code).toBe('appointment_overlap');
    expect(res.results[1]?.conflict?.messageAr).toMatch(/[؀-ۿ]/);
    if (overlap.type !== 'appointment.book') throw new Error('unexpected command');
    const rows = await rowsOf(
      server.ids.A.tenantId,
      sql`select 1 from s1.appointment where id = ${overlap.payload.appointmentId}`,
    );
    expect(rows).toHaveLength(0);
    // The conflict is stored: a replay returns it again.
    expect((await server.post(token, [overlap])).results).toEqual([res.results[1]]);
  });

  it('lets a cancelled slot be booked again', async () => {
    const token = await server.login();
    const practitioner = server.ids.A.practitioners[0]?.id ?? '';
    const first = cmd.book(practitioner, at('12:00'), at('12:30'));
    if (first.type !== 'appointment.book') throw new Error('unexpected command');
    const again = cmd.book(practitioner, at('12:00'), at('12:30'));
    const res = await server.post(token, [first, cmd.cancel(first.payload.appointmentId), again]);
    expect(res.results.map((r) => r.status)).toEqual(['applied', 'applied', 'applied']);
  });

  it('allows the same slot for two practitioners', async () => {
    const token = await server.login();
    const [p1, p2] = server.ids.A.practitioners;
    const res = await server.post(token, [
      cmd.book(p1?.id ?? '', at('14:00'), at('14:30')),
      cmd.book(p2?.id ?? '', at('14:00'), at('14:30')),
    ]);
    expect(res.results.map((r) => r.status)).toEqual(['applied', 'applied']);
  });

  it('refuses a slot that ends before it starts', async () => {
    const token = await server.login();
    const practitioner = server.ids.A.practitioners[0]?.id ?? '';
    const res = await server.post(token, [cmd.book(practitioner, at('16:00'), at('15:00'))]);
    expect(res.results[0]?.status).toBe('refused');
  });
});
