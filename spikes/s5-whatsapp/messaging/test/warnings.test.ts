// Review of 0.3-S5a (B3): each documented warning trips the breaker on its own (the locked
// breaker test always follows with CAPPED, which would hide a missed warning), and a second
// signal during the pause raises no second alert.
import { describe, expect, it } from 'vitest';
import { type Env, newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();
const vars = { name: 'سارة', date: '2026-11-18', time: '10:30' };

async function twoQueued(env: Env) {
  const p = await env.patient('c-a');
  await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
  for (let i = 0; i < 2; i++) {
    await env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', vars);
  }
}

describe('each warning alone', () => {
  for (const warning of ['FIRST_WARNING', 'SECOND_WARNING', 'CAPPED', 'timelock'] as const) {
    it(`pauses on ${warning} by itself, alerting once`, async () => {
      const env = track(await newEnv(pg.db));
      await twoQueued(env);
      const fake = env.fakes.clinics;
      if (warning === 'timelock') await fake?.timelock('clinic-a', true);
      else await fake?.capping('clinic-a', warning);

      const session = await env.query<{ needs_admin_resume: boolean }>(
        "select needs_admin_resume from s5.session where name = 'clinic-a'",
      );
      expect(session).toEqual([{ needs_admin_resume: true }]);
      const statuses = await env.query<{ status: string }>(
        'select status from s5.delivery_attempt order by seq',
      );
      expect(statuses.map((r) => r.status)).toEqual(['fallback', 'fallback']);
      expect(await env.query('select kind from s5.admin_alert')).toEqual([{ kind: 'breaker' }]);

      // A second signal while paused: no second alert.
      if (warning === 'timelock') await fake?.capping('clinic-a', 'FIRST_WARNING');
      else await fake?.timelock('clinic-a', true);
      expect(await env.query('select kind from s5.admin_alert')).toEqual([{ kind: 'breaker' }]);
    });
  }

  it('does not pause on capping NONE or an inactive timelock', async () => {
    const env = track(await newEnv(pg.db));
    await twoQueued(env);
    await env.fakes.clinics?.capping('clinic-a', 'NONE');
    await env.fakes.clinics?.timelock('clinic-a', false);
    expect(await env.query('select kind from s5.admin_alert')).toEqual([]);
    await env.drain('clinic-a');
    const statuses = await env.query<{ status: string }>('select status from s5.delivery_attempt');
    expect(statuses.map((r) => r.status)).toEqual(['sent', 'sent']);
  });
});
