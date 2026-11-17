// Criterion 6 (MSG-01, MSG-02, MSG-16, OD-46): ban signals pause the session for 24 h and then
// until the clinic admin resumes it; outages take the same fallback without the pause; a send
// whose outcome is unknown is never retried and becomes a "maybe sent" manual task.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { spawnWorker } from '../src/spawn.ts';
import { type Env, newEnv, type Patient, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();
const DAY = 24 * 3_600_000;
const vars = { name: 'سارة', date: '2026-11-18', time: '10:30' };

async function ready(env: Env): Promise<Patient> {
  const p = await env.patient('c-a');
  await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
  return p;
}
const queue = async (env: Env, p: Patient, n: number) => {
  for (let i = 0; i < n; i++) {
    expect(
      (await env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', vars)).status,
    ).toBe('queued');
  }
};
const statuses = (env: Env) =>
  env
    .query<{ status: string }>('select status from s5.delivery_attempt order by seq')
    .then((r) => r.map((x) => x.status));
const tasks = (env: Env) =>
  env.query<{ link: string; maybe_sent: boolean }>(
    'select link, maybe_sent from s5.manual_task order by id',
  );
const alerts = (env: Env) =>
  env.query<{ kind: string }>('select kind from s5.admin_alert order by id');
const session = async (env: Env) =>
  (
    await env.query<{
      paused_until: string | null;
      needs_admin_resume: boolean;
      gateway_down: boolean;
    }>(
      "select paused_until, needs_admin_resume, gateway_down from s5.session where name = 'clinic-a'",
    )
  )[0];
const sendTexts = (env: Env) =>
  (env.fakes.clinics?.calls ?? []).filter((c) => c.path === '/api/sendText');
const resume = (env: Env, token = env.config.adminToken) =>
  env.messaging.app.inject({
    method: 'POST',
    url: '/admin/sessions/clinic-a/resume',
    headers: { authorization: `Bearer ${token}` },
  });

describe('circuit breaker on ban signals', () => {
  for (const code of [463, 475] as const) {
    it(`pauses 24 h on ${String(code)} returned by send, with fallback and one alert`, async () => {
      const env = track(await newEnv(pg.db));
      const p = await ready(env);
      await queue(env, p, 3);
      env.fakes.clinics?.setSendMode('clinic-a', code === 463 ? 'error463' : 'error475');
      await env.drain('clinic-a');

      expect(await statuses(env)).toEqual(['failed', 'fallback', 'fallback']);
      const t = await tasks(env);
      expect(t).toHaveLength(3);
      for (const task of t) {
        expect(task.link.startsWith(`https://wa.me/${p.phone.slice(1)}?text=`)).toBe(true);
        expect(task.maybe_sent).toBe(false);
      }
      expect(await env.query('select id from s5.inbox')).toHaveLength(3);
      expect(await alerts(env)).toEqual([{ kind: 'breaker' }]);
      const s = await session(env);
      expect(s?.needs_admin_resume).toBe(true);
      expect(Date.parse(s?.paused_until ?? '')).toBe(env.clock.now() + DAY);
      expect(sendTexts(env)).toHaveLength(1);
    });
  }

  it('stays paused after 24 h until the clinic admin resumes it', async () => {
    const env = track(await newEnv(pg.db));
    const p = await ready(env);
    await queue(env, p, 1);
    env.fakes.clinics?.setSendMode('clinic-a', 'error463');
    await env.drain('clinic-a');
    env.fakes.clinics?.setSendMode('clinic-a', 'ok');

    expect((await resume(env)).statusCode).toBe(409);
    expect((await resume(env, 'wrong')).statusCode).toBe(401);
    env.clock.advance(DAY + 1_000);
    await queue(env, p, 1);
    await env.drain('clinic-a');
    expect(await statuses(env)).toEqual(['failed', 'fallback']);
    expect(sendTexts(env)).toHaveLength(1);

    expect((await resume(env)).statusCode).toBe(200);
    await queue(env, p, 1);
    await env.drain('clinic-a');
    expect(await statuses(env)).toEqual(['failed', 'fallback', 'sent']);
  });

  for (const code of [463, 475] as const) {
    it(`trips on a later message.ack ERROR carrying ${String(code)}`, async () => {
      const env = track(await newEnv(pg.db));
      const p = await ready(env);
      await queue(env, p, 1);
      await env.drain('clinic-a');
      await queue(env, p, 2);
      const sent = sendTexts(env)[0];
      const res = await env.fakes.clinics?.ack('clinic-a', sent?.messageId ?? '', -1, {
        error: code,
      });
      expect(res?.status).toBe(200);
      await env.drain('clinic-a');
      expect(await statuses(env)).toEqual(['failed', 'fallback', 'fallback']);
      expect(await alerts(env)).toEqual([{ kind: 'breaker' }]);
      expect((await session(env))?.needs_admin_resume).toBe(true);
    });
  }

  it('trips on the documented warnings (capping and reachout timelock), alerting once', async () => {
    for (const warning of ['FIRST_WARNING', 'SECOND_WARNING', 'CAPPED', 'timelock'] as const) {
      const env = track(await newEnv(pg.db));
      const p = await ready(env);
      await queue(env, p, 2);
      const fake = env.fakes.clinics;
      if (warning === 'timelock') await fake?.timelock('clinic-a', true);
      else await fake?.capping('clinic-a', warning);
      await fake?.capping('clinic-a', 'CAPPED');
      await env.drain('clinic-a');
      expect(await statuses(env), warning).toEqual(['fallback', 'fallback']);
      expect(await alerts(env), warning).toEqual([{ kind: 'breaker' }]);
      expect(sendTexts(env)).toEqual([]);
    }
  });

  it('never re-pairs: the service code has no start, restart, logout or QR call', () => {
    const dir = join(import.meta.dirname, '../src');
    for (const file of readdirSync(dir)) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text, file).not.toMatch(/\/(start|restart|logout)['`]|auth\/qr|request-code/);
    }
  });
});

describe('fallback on outages (no 24 h pause)', () => {
  it('falls back while the gateway is down and resumes when the session is WORKING again', async () => {
    const env = track(await newEnv(pg.db));
    const p = await ready(env);
    await queue(env, p, 2);
    env.fakes.clinics?.setDown(true);
    await env.drain('clinic-a');
    expect(await statuses(env)).toEqual(['failed', 'fallback']);
    expect((await tasks(env)).map((t) => t.maybe_sent)).toEqual([false, false]);
    expect(await alerts(env)).toEqual([{ kind: 'health:down' }]);
    const s = await session(env);
    expect(s?.paused_until).toBeNull();
    expect(s?.gateway_down).toBe(true);

    env.fakes.clinics?.setDown(false);
    await env.fakes.clinics?.status('clinic-a', 'WORKING');
    await queue(env, p, 1);
    await env.drain('clinic-a');
    expect(await statuses(env)).toEqual(['failed', 'fallback', 'sent']);
  });

  for (const state of ['FAILED', 'STOPPED'] as const) {
    it(`falls back on ${state} and resumes on WORKING`, async () => {
      const env = track(await newEnv(pg.db));
      const p = await ready(env);
      await queue(env, p, 1);
      await env.fakes.clinics?.status('clinic-a', state);
      await env.drain('clinic-a');
      expect(await statuses(env)).toEqual(['fallback']);
      expect(await alerts(env)).toEqual([{ kind: 'health:down' }]);
      expect((await session(env))?.paused_until).toBeNull();
      await env.fakes.clinics?.status('clinic-a', 'WORKING');
      await queue(env, p, 1);
      await env.drain('clinic-a');
      expect(await statuses(env)).toEqual(['fallback', 'sent']);
    });
  }
});

describe('at most once', () => {
  it('turns a send that timed out into a "maybe sent" task and never retries it', async () => {
    const env = track(await newEnv(pg.db, { sendTimeoutMs: 300 }));
    const p = await ready(env);
    await queue(env, p, 2);
    env.fakes.clinics?.setSendMode('clinic-a', 'timeout');
    await env.drain('clinic-a');
    await env.drain('clinic-a');
    expect(await statuses(env)).toEqual(['unknown', 'fallback']);
    expect((await tasks(env)).map((t) => t.maybe_sent)).toEqual([true, false]);
    expect(sendTexts(env)).toHaveLength(1);
    expect((await session(env))?.paused_until).toBeNull();
  });

  it('marks a send left in "sending" by a crashed worker as unknown, with no second call', async () => {
    const env = track(await newEnv(pg.db));
    const p = await ready(env);
    await queue(env, p, 1);
    env.fakes.clinics?.setSendMode('clinic-a', 'hang');
    const worker = spawnWorker({ ...env.config, queue: 'worker' });
    await worker.ready;
    await env.fakes.clinics?.waitForCall('/api/sendText', 30_000);
    await worker.kill();
    env.fakes.clinics?.releaseHung();
    await env.drain('clinic-a');
    expect(await statuses(env)).toEqual(['unknown']);
    expect((await tasks(env)).map((t) => t.maybe_sent)).toEqual([true]);
    expect(sendTexts(env)).toHaveLength(1);
  });

  it('ends as unknown when the job expires mid-send, with no second call', async () => {
    const env = track(await newEnv(pg.db, { sendTimeoutMs: 4_000 }));
    const p = await ready(env);
    await queue(env, p, 2);
    env.fakes.clinics?.setSendMode('clinic-a', 'hang');
    const workers = [
      spawnWorker({ ...env.config, queue: 'worker', tickExpireSeconds: 1 }),
      spawnWorker({ ...env.config, queue: 'worker', tickExpireSeconds: 1 }),
    ];
    try {
      await Promise.all(workers.map((w) => w.ready));
      const deadline = Date.now() + 40_000;
      while (
        (await statuses(env)).includes('queued') ||
        (await statuses(env)).includes('sending')
      ) {
        if (Date.now() > deadline) throw new Error(`stuck: ${(await statuses(env)).join(',')}`);
        await new Promise((r) => setTimeout(r, 250));
      }
      expect(await statuses(env)).toEqual(['unknown', 'fallback']);
      expect((await tasks(env)).map((t) => t.maybe_sent)).toEqual([true, false]);
      expect(sendTexts(env)).toHaveLength(1);
    } finally {
      for (const w of workers) await w.stop();
      env.fakes.clinics?.releaseHung();
    }
  });
});
