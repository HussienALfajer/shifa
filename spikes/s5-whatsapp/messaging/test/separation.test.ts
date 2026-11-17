// Criterion 10 (MSG-09): (container, session) is the only routing key. Inbound on clinic A never
// changes clinic B; a verification code sent to a clinic number is ordinary inbound there (opt-in)
// and never verifies; an event naming the platform session signed by the clinics container is
// refused; unknown sessions are refused; the platform session runs in its own container.
import { describe, expect, it } from 'vitest';
import { createMessaging, type MessagingConfig } from '../src/index.ts';
import { INSTANT_PACING, newEnv, SESSIONS, useDatabase, useEnvs } from './harness.ts';
import { chatOf, issue, outcomes, platformSends, poll } from './verify-helpers.ts';

const pg = useDatabase();
const track = useEnvs();
const vars = { name: 'سارة', date: '2026-11-18', time: '10:30' };

describe('tenant and role separation', () => {
  it('inbound on clinic A never changes clinic B', async () => {
    const env = track(await newEnv(pg.db));
    const a = await env.patient('c-a');
    await env.messaging.registerPatient('c-b', 'pb', a.phone);
    await env.fakes.clinics?.inbound('clinic-a', { from: a.chatId, body: 'مرحبا' });
    await env.fakes.clinics?.inbound('clinic-a', { from: a.chatId, body: 'إيقاف' });
    const rows = await env.query<{ clinic_id: string }>('select clinic_id from s5.optin');
    expect(rows.map((r) => r.clinic_id)).toEqual(['c-a']);
    expect(await env.messaging.sendWhatsApp('c-b', 'pb', 'appointment_reminder', vars)).toEqual({
      status: 'refused',
      reason: 'no_opt_in',
    });
    expect(await env.query("select id from s5.delivery_attempt where clinic_id = 'c-b'")).toEqual(
      [],
    );
  });

  it('a code sent to a clinic number opts in there and never verifies', async () => {
    const env = track(await newEnv(pg.db));
    const a = await env.patient('c-a');
    const n = await issue(env, 'device-2001', a.phone);
    const res = await env.fakes.clinics?.inbound('clinic-a', { from: a.chatId, body: n.text });
    expect(res?.status).toBe(200);
    const polled = await poll(env, n.nonceId, {
      deviceId: 'device-2001',
      deviceSecret: n.deviceSecret,
    });
    expect(polled.body['status']).toBe('pending');
    expect(await outcomes(env)).toEqual([]);
    expect(platformSends(env)).toEqual([]);
    expect(env.fakes.clinics?.calls.filter((c) => c.path === '/api/sendText')).toEqual([]);
    expect(
      (await env.messaging.sendWhatsApp('c-a', a.patientId, 'appointment_reminder', vars)).status,
    ).toBe('queued');
  });

  it('refuses an event naming the platform session signed by the clinics container', async () => {
    const env = track(await newEnv(pg.db));
    env.allowlist.add('+963930012345');
    const n = await issue(env, 'device-2002', '+963930012345');
    const clinics = env.fakes.clinics;
    // Signed with the clinics key, posted to the clinics path: the clinics container does not
    // own `platform`.
    const own = await clinics?.inbound('platform', {
      from: chatOf('+963930012345'),
      body: n.text,
    });
    expect(own?.status).toBe(403);
    // Signed with the clinics key, posted to the platform path: wrong key there.
    const crossPath = await clinics?.inbound(
      'platform',
      { from: chatOf('+963930012345'), body: n.text },
      { url: env.fakes.platform?.webhookUrl() ?? '' },
    );
    expect(crossPath?.status).toBe(401);
    const polled = await poll(env, n.nonceId, {
      deviceId: 'device-2002',
      deviceSecret: n.deviceSecret,
    });
    expect(polled.body['status']).toBe('pending');
    expect(await env.query('select * from s5.platform_inbound')).toEqual([]);
  });

  it('refuses unknown sessions on both containers', async () => {
    const env = track(await newEnv(pg.db));
    for (const fake of [env.fakes.clinics, env.fakes.platform]) {
      const res = await fake?.inbound('nobody', { from: chatOf('+963930012345'), body: 'x' });
      expect(res?.status).toBe(403);
    }
  });

  it('refuses a configuration that mixes roles in one container or blurs a role', async () => {
    const base = {
      databaseUrl: 'postgres://unused@127.0.0.1:1/none',
      containers: {
        clinics: { wahaUrl: 'http://127.0.0.1:1', apiKey: 'k'.repeat(16), hmacKey: 'h'.repeat(16) },
        platform: {
          wahaUrl: 'http://127.0.0.1:2',
          apiKey: 'k'.repeat(16),
          hmacKey: 'h'.repeat(16),
        },
      },
      allowlist: new Set<string>(),
      pacing: INSTANT_PACING,
      sendTimeoutMs: 1_000,
      adminToken: 't'.repeat(16),
      queue: 'off',
      verify: { platformNumber: '+963990000001', serverKey: 's'.repeat(32) },
    } satisfies Omit<MessagingConfig, 'sessions'>;
    const mixed = SESSIONS.map((s) => ({ ...s, container: 'clinics' }));
    await expect(createMessaging({ ...base, sessions: mixed })).rejects.toThrow(/container/);
    const platformWithClinic = SESSIONS.map((s) =>
      s.role === 'platform' ? { ...s, clinicId: 'c-a' } : s,
    );
    await expect(createMessaging({ ...base, sessions: platformWithClinic })).rejects.toThrow(
      /clinic/,
    );
    const twoPlatforms = [
      ...SESSIONS,
      { ...SESSIONS[2], name: 'platform-2' } as (typeof SESSIONS)[number],
    ];
    await expect(createMessaging({ ...base, sessions: twoPlatforms })).rejects.toThrow(/platform/);
  });
});
