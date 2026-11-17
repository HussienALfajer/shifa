// Criterion 4 (MSG-13, MSG-14): a patient gets messages only after writing first; the stop
// keyword opts out at once with one confirmation; any later inbound opts back in. Edits, revokes
// and reactions count as inbound; @lid senders are resolved first; groups and broadcasts never
// count.
import { describe, expect, it } from 'vitest';
import { type Env, newEnv, type Patient, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();
const vars = { name: 'سارة', date: '2026-11-18', time: '10:30' };

const send = (env: Env, p: Patient) =>
  env.messaging.sendWhatsApp(p.clinicId, p.patientId, 'appointment_reminder', vars);
const sentTexts = (env: Env) =>
  (env.fakes.clinics?.calls ?? []).filter((c) => c.path === '/api/sendText');
const inbound = async (env: Env, p: Patient, body: string) => {
  const res = await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body });
  expect(res?.status).toBe(200);
  env.clock.advance(1_000);
};

describe('opt-in', () => {
  it('refuses a send to a patient who never wrote, before anything is queued', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    expect(await send(env, p)).toEqual({ status: 'refused', reason: 'no_opt_in' });
    expect(await env.query('select id from s5.delivery_attempt')).toEqual([]);
    const refusals = await env.query<{ reason: string }>('select reason from s5.refusal');
    expect(refusals).toEqual([{ reason: 'no_opt_in' }]);
  });

  it('opts out on every keyword form', async () => {
    for (const keyword of [
      'إيقاف',
      'ايقاف',
      'STOP',
      'stop',
      '  Stop ',
      'إِيقَاف',
      'إيقاف\n',
      'sToP',
      'ايقاف  ',
    ]) {
      const env = track(await newEnv(pg.db));
      const p = await env.patient('c-a');
      await inbound(env, p, 'مرحبا');
      await inbound(env, p, keyword);
      expect(await send(env, p), JSON.stringify(keyword)).toEqual({
        status: 'refused',
        reason: 'opted_out',
      });
    }
  });

  it('drops the next queued message and sends exactly one confirmation', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await inbound(env, p, 'مرحبا');
    expect((await send(env, p)).status).toBe('queued');
    await inbound(env, p, 'إيقاف');
    await inbound(env, p, 'stop');
    await env.drain('clinic-a');

    const rows = await env.query<{ template_key: string; status: string }>(
      'select template_key, status from s5.delivery_attempt order by seq',
    );
    expect(rows).toEqual([
      { template_key: 'appointment_reminder', status: 'dropped' },
      { template_key: 'optout_confirmation', status: 'sent' },
    ]);
    expect(sentTexts(env)).toHaveLength(1);
  });

  it('opts back in on a later inbound message', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await inbound(env, p, 'مرحبا');
    await inbound(env, p, 'إيقاف');
    await inbound(env, p, 'أريد المواعيد مجدداً');
    expect((await send(env, p)).status).toBe('queued');
  });

  it('counts edits, revokes and reactions as inbound, but never as the keyword', async () => {
    for (const kind of ['edited', 'revoked', 'reaction'] as const) {
      const env = track(await newEnv(pg.db));
      const p = await env.patient('c-a');
      const res = await env.fakes.clinics?.inbound('clinic-a', {
        from: p.chatId,
        body: 'stop',
        kind,
      });
      expect(res?.status, kind).toBe(200);
      expect((await send(env, p)).status, kind).toBe('queued');
    }
  });

  it('resolves an @lid sender through the receiving container first', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    const lid = '204011500700123@lid';
    env.fakes.clinics?.registerLid('clinic-a', lid, p.chatId);
    await env.fakes.clinics?.inbound('clinic-a', { from: lid, body: 'مرحبا' });
    expect((await send(env, p)).status).toBe('queued');
    expect(env.fakes.clinics?.calls.some((c) => c.path.startsWith('/api/clinic-a/lids/'))).toBe(
      true,
    );
  });

  it('ignores an @lid sender that cannot be resolved', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    env.fakes.clinics?.registerLid('clinic-a', '204011500700999@lid', null);
    await env.fakes.clinics?.inbound('clinic-a', { from: '204011500700999@lid', body: 'مرحبا' });
    expect(await send(env, p)).toEqual({ status: 'refused', reason: 'no_opt_in' });
  });

  it('ignores groups, broadcasts, status replies and our own messages', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    const fake = env.fakes.clinics;
    await fake?.inbound('clinic-a', {
      from: '120363000000000001@g.us',
      participant: p.chatId,
      body: 'مرحبا',
    });
    await fake?.inbound('clinic-a', {
      from: 'status@broadcast',
      participant: p.chatId,
      body: 'مرحبا',
    });
    await fake?.inbound('clinic-a', { from: '120363000000000002@broadcast', body: 'مرحبا' });
    await fake?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا', fromMe: true });
    expect(await send(env, p)).toEqual({ status: 'refused', reason: 'no_opt_in' });
  });

  it('keeps opt-in per clinic: clinic B never sees clinic A traffic', async () => {
    const env = track(await newEnv(pg.db));
    const a = await env.patient('c-a');
    await env.messaging.registerPatient('c-b', a.patientId, a.phone);
    await inbound(env, a, 'مرحبا');
    const b = { ...a, clinicId: 'c-b' };
    expect(await send(env, b)).toEqual({ status: 'refused', reason: 'no_opt_in' });
  });
});
