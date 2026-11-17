// Criterion 7 (MSG-17): the 5-minute health job maps WAHA session states to a clinic-visible
// state, alerts once per transition into an unlinked state and warns when the phone has not
// been seen for 10 days (last successful send or inbound; GOWS signal, if any, in 0.3-S5c).
// The job's handler is called directly: cron cannot run every few seconds.
import { describe, expect, it } from 'vitest';
import { type Env, newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();
const DAY = 24 * 3_600_000;

const health = async (env: Env, name = 'clinic-a') =>
  (await env.query<{ health: string }>('select health from s5.session where name = $1', [name]))[0]
    ?.health;
const alerts = (env: Env) =>
  env.query<{ session: string; kind: string }>(
    'select session, kind from s5.admin_alert order by id',
  );

describe('session health', () => {
  it('maps WAHA states to linked, needs_qr, paused and down', async () => {
    const env = track(await newEnv(pg.db));
    const fake = env.fakes.clinics;
    const cases: [string, string][] = [
      ['WORKING', 'linked'],
      ['SCAN_QR_CODE', 'needs_qr'],
      ['FAILED', 'down'],
      ['STOPPED', 'down'],
      ['WORKING', 'linked'],
    ];
    for (const [state, expected] of cases) {
      await fake?.status('clinic-a', state, { emit: false });
      await env.messaging.runHealth();
      expect(await health(env), state).toBe(expected);
    }
    fake?.setDown(true);
    await env.messaging.runHealth();
    expect(await health(env)).toBe('down');
    fake?.setDown(false);
    await env.messaging.runHealth();
    expect(await health(env)).toBe('linked');

    env.fakes.clinics?.setSendMode('clinic-a', 'error463');
    const p = await env.patient('c-a');
    await fake?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    await env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', {
      name: 'سارة',
      date: '2026-11-18',
      time: '10:30',
    });
    await env.drain('clinic-a');
    await env.messaging.runHealth();
    expect(await health(env)).toBe('paused');
  });

  it('alerts once per transition into an unlinked state', async () => {
    const env = track(await newEnv(pg.db));
    const fake = env.fakes.clinics;
    await env.messaging.runHealth();
    await env.messaging.runHealth();
    expect(await alerts(env)).toEqual([]);
    await fake?.status('clinic-a', 'SCAN_QR_CODE', { emit: false });
    await env.messaging.runHealth();
    await env.messaging.runHealth();
    expect(await alerts(env)).toEqual([{ session: 'clinic-a', kind: 'health:needs_qr' }]);
    await fake?.status('clinic-a', 'FAILED', { emit: false });
    await env.messaging.runHealth();
    await fake?.status('clinic-a', 'WORKING', { emit: false });
    await env.messaging.runHealth();
    await env.messaging.runHealth();
    expect(await alerts(env)).toEqual([
      { session: 'clinic-a', kind: 'health:needs_qr' },
      { session: 'clinic-a', kind: 'health:down' },
    ]);
    // Other sessions were not touched.
    expect(await health(env, 'clinic-b')).toBe('linked');
  });

  it('warns once when the phone has not been seen for 10 days, and again after it was', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    env.clock.advance(10 * DAY - 60_000);
    await env.messaging.runHealth();
    expect((await alerts(env)).filter((a) => a.session === 'clinic-a')).toEqual([]);
    env.clock.advance(120_000);
    await env.messaging.runHealth();
    await env.messaging.runHealth();
    expect((await alerts(env)).filter((a) => a.session === 'clinic-a')).toEqual([
      { session: 'clinic-a', kind: 'phone_not_seen' },
    ]);
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'ما زلت هنا' });
    env.clock.advance(10 * DAY + 60_000);
    await env.messaging.runHealth();
    expect(
      (await alerts(env)).filter((a) => a.kind === 'phone_not_seen' && a.session === 'clinic-a'),
    ).toHaveLength(2);
  });
});
