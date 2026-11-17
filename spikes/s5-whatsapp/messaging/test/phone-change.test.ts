// Security review of 0.3-S5a (B1): the allowlist (MSG-32) and opt-in (MSG-13) hold at send
// time, not only at enqueue. A message queued for one number never goes to the patient's new
// number, and a new number has to write first.
import { describe, expect, it } from 'vitest';
import { newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();
const vars = { name: 'سارة', date: '2026-11-18', time: '10:30' };

describe('number changed after queueing', () => {
  it('drops a queued message when the new number is off the allowlist', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    expect(
      (await env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', vars)).status,
    ).toBe('queued');

    const other = await env.patient('c-a', { allowlisted: false });
    await env.messaging.registerPatient('c-a', p.patientId, other.phone);
    await env.drain('clinic-a');

    expect(env.fakes.clinics?.calls.filter((c) => c.path === '/api/sendText')).toEqual([]);
    const rows = await env.query<{ status: string; reason: string }>(
      'select status, reason from s5.delivery_attempt',
    );
    expect(rows).toEqual([{ status: 'dropped', reason: 'phone_changed' }]);
  });

  it('drops a queued message when its number leaves the allowlist before sending', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    await env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', vars);
    env.allowlist.delete(p.phone);
    await env.drain('clinic-a');
    expect(env.fakes.clinics?.calls.filter((c) => c.path === '/api/sendText')).toEqual([]);
    const rows = await env.query<{ reason: string }>('select reason from s5.delivery_attempt');
    expect(rows).toEqual([{ reason: 'allowlist' }]);
  });

  it('makes a new number write first (opt-in belongs to the number)', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    const other = await env.patient('c-a');
    await env.messaging.registerPatient('c-a', p.patientId, other.phone);
    expect(
      await env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', vars),
    ).toEqual({
      status: 'refused',
      reason: 'no_opt_in',
    });
  });
});
