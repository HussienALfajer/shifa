// Criterion 8 (MSG-18): delivery and read acks move a delivery attempt forward only; duplicate
// and out-of-order acks never move it back; ERROR after SERVER or DEVICE is handled.
import { describe, expect, it } from 'vitest';
import { type Env, newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();

async function sentMessage(env: Env): Promise<string> {
  const p = await env.patient('c-a');
  await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
  await env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_confirmation', {
    name: 'سارة',
    date: '2026-11-18',
    time: '10:30',
  });
  await env.drain('clinic-a');
  const id = env.fakes.clinics?.calls.find((c) => c.path === '/api/sendText')?.messageId;
  if (!id) throw new Error('no message id');
  return id;
}
const status = async (env: Env) =>
  (await env.query<{ status: string }>('select status from s5.delivery_attempt'))[0]?.status;

describe('acks', () => {
  it('moves sent → delivered → read', async () => {
    const env = track(await newEnv(pg.db));
    const id = await sentMessage(env);
    expect(await status(env)).toBe('sent');
    await env.fakes.clinics?.ack('clinic-a', id, 2);
    expect(await status(env)).toBe('delivered');
    await env.fakes.clinics?.ack('clinic-a', id, 3);
    expect(await status(env)).toBe('read');
  });

  it('ignores duplicate and out-of-order acks', async () => {
    const env = track(await newEnv(pg.db));
    const id = await sentMessage(env);
    const fake = env.fakes.clinics;
    fake?.holdWebhooks();
    const pending = [
      fake?.ack('clinic-a', id, 1),
      fake?.ack('clinic-a', id, 2),
      fake?.ack('clinic-a', id, 3),
    ];
    await fake?.releaseWebhooks({ reverse: true });
    await Promise.all(pending);
    expect(await status(env)).toBe('read');
    fake?.duplicateNext();
    await fake?.ack('clinic-a', id, 2);
    await fake?.ack('clinic-a', id, 4);
    expect(await status(env)).toBe('read');
  });

  it('keeps a delivered message delivered on ERROR without a ban code, and records it', async () => {
    const env = track(await newEnv(pg.db));
    const id = await sentMessage(env);
    await env.fakes.clinics?.ack('clinic-a', id, 2);
    await env.fakes.clinics?.ack('clinic-a', id, -1);
    const rows = await env.query<{ status: string; error_code: string | null }>(
      'select status, error_code from s5.delivery_attempt',
    );
    expect(rows).toEqual([{ status: 'delivered', error_code: 'ack_error' }]);
    expect(await env.query('select id from s5.admin_alert')).toEqual([]);
  });

  it('trips the breaker on ERROR with a ban code after DEVICE, keeping the delivered state', async () => {
    const env = track(await newEnv(pg.db));
    const id = await sentMessage(env);
    await env.fakes.clinics?.ack('clinic-a', id, 2);
    await env.fakes.clinics?.ack('clinic-a', id, -1, { error: 463 });
    expect(await status(env)).toBe('delivered');
    const alerts = await env.query<{ kind: string }>('select kind from s5.admin_alert');
    expect(alerts).toEqual([{ kind: 'breaker' }]);
  });

  it('fails a message that only reached SERVER when ERROR arrives, with a manual task', async () => {
    const env = track(await newEnv(pg.db));
    const id = await sentMessage(env);
    await env.fakes.clinics?.ack('clinic-a', id, 1);
    await env.fakes.clinics?.ack('clinic-a', id, -1);
    expect(await status(env)).toBe('failed');
    expect(await env.query('select id from s5.manual_task')).toHaveLength(1);
  });

  it('ignores an ack for a message of another session', async () => {
    const env = track(await newEnv(pg.db));
    const id = await sentMessage(env);
    await env.fakes.clinics?.ack('clinic-b', id, 3);
    expect(await status(env)).toBe('sent');
  });
});
