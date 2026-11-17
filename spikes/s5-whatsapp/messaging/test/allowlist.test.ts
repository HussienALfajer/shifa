// Criterion 3 (MSG-11, MSG-32): every send goes through sendWhatsApp; outside production only
// allowlisted numbers receive anything, and a dropped send logs no phone number.
import { describe, expect, it } from 'vitest';
import { newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();

const vars = { name: 'سارة', date: '2026-11-18', time: '10:30' };

describe('allowlist', () => {
  it('drops a send to a number that is not on the allowlist, before queueing', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a', { allowlisted: false });
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });

    const result = await env.messaging.sendWhatsApp(
      'c-a',
      p.patientId,
      'appointment_reminder',
      vars,
    );
    expect(result).toEqual({ status: 'dropped', reason: 'allowlist' });
    expect(await env.query('select id from s5.delivery_attempt')).toEqual([]);
    await env.drain('clinic-a');
    expect(env.fakes.clinics?.calls.filter((c) => c.path === '/api/sendText')).toEqual([]);

    const drops = env.logs.filter((line) => line.includes('allowlist_drop'));
    expect(drops).toHaveLength(1);
    const record = JSON.parse(drops[0] ?? '{}') as Record<string, unknown>;
    expect(record).toMatchObject({
      event: 'allowlist_drop',
      clinicId: 'c-a',
      templateKey: 'appointment_reminder',
    });
    expect(drops[0]).not.toMatch(/\d{8,}/);
    expect(drops[0]?.includes(p.phone.slice(4))).toBe(false);
  });

  it('queues and sends to an allowlisted, opted-in number', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });

    const result = await env.messaging.sendWhatsApp(
      'c-a',
      p.patientId,
      'appointment_reminder',
      vars,
    );
    expect(result.status).toBe('queued');
    await env.drain('clinic-a');
    const sends = env.fakes.clinics?.calls.filter((c) => c.path === '/api/sendText') ?? [];
    expect(sends.map((c) => c.chatId)).toEqual([p.chatId]);
  });

  it('applies the allowlist to the opt-out confirmation too', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a', { allowlisted: false });
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'stop' });
    await env.drain('clinic-a');
    expect(env.fakes.clinics?.calls.filter((c) => c.path === '/api/sendText')).toEqual([]);
    expect(env.logs.some((line) => line.includes('allowlist_drop'))).toBe(true);
  });

  it('refuses unknown templates and missing or extra placeholders', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    await expect(env.messaging.sendWhatsApp('c-a', p.patientId, 'free_text', vars)).rejects.toThrow(
      /template/,
    );
    await expect(
      env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', { name: 'x' }),
    ).rejects.toThrow(/placeholder/);
    await expect(
      env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', {
        ...vars,
        extra: 'y',
      }),
    ).rejects.toThrow(/placeholder/);
  });
});
