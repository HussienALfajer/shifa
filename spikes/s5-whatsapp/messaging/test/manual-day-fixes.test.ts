// Fixes from the owner's manual day (0.3-S5c, 2026-11-19), against the fake that now behaves as
// the real WAHA did: a session the container does not know is STOPPED, not the column's
// `WORKING` default; a FAILED session (unlinked on the phone) is stopped before the admin page's
// start, because a bare start leaves it FAILED; acks naming the `@lid` chat settle the send
// that returned `<phone>@c.us`.
import { describe, expect, it } from 'vitest';
import { startAdminPage } from '../tools/admin-page.ts';
import { newEnv, useDatabase, useEnvs } from './harness.ts';

const pg = useDatabase();
const track = useEnvs();

describe('manual day fixes', () => {
  it('a session WAHA does not know shows STOPPED and down, not WORKING', async () => {
    const env = track(await newEnv(pg.db, { unlinked: ['platform'] }));
    await env.messaging.runHealth();
    const rows = await env.query<{ waha_status: string; health: string; gateway_down: boolean }>(
      "select waha_status, health, gateway_down from s5.session where name = 'platform'",
    );
    expect(rows[0]).toEqual({ waha_status: 'STOPPED', health: 'down', gateway_down: false });
    expect(env.logs.some((l) => l.includes('health_unreachable'))).toBe(false);
  });

  it('start on a FAILED session stops it first, so it starts again', async () => {
    const env = track(await newEnv(pg.db));
    const fake = env.fakes.clinics;
    await fake?.status('clinic-a', 'FAILED');
    const page = await startAdminPage(env.messaging);
    try {
      const res = await fetch(`${page.url}/api/sessions/clinic-a/start`, {
        method: 'POST',
        headers: { 'x-admin-token': page.token },
      });
      expect(res.status).toBe(200);
      const paths = (fake?.calls ?? []).map((c) => `${c.method} ${c.path}`);
      expect(paths).toEqual([
        'GET /api/sessions/clinic-a',
        'POST /api/sessions/clinic-a/stop',
        'POST /api/sessions/clinic-a/start',
      ]);
      await env.messaging.runHealth();
      const rows = await env.query<{ waha_status: string }>(
        "select waha_status from s5.session where name = 'clinic-a'",
      );
      expect(rows[0]?.waha_status).toBe('WORKING');
    } finally {
      await page.close();
    }
  });

  it('a capping warning on a message event (not session.status) trips the breaker', async () => {
    const env = track(await newEnv(pg.db));
    const fake = env.fakes.clinics;
    const p = await env.patient('c-a');
    // The capping change's own session.status goes nowhere; only the next message carries it.
    const url = fake?.webhookUrl() ?? '';
    fake?.setWebhookUrl('http://127.0.0.1:9/');
    await fake?.capping('clinic-a', 'FIRST_WARNING');
    fake?.setWebhookUrl(url);
    await fake?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    const rows = await env.query<{ needs_admin_resume: boolean }>(
      "select needs_admin_resume from s5.session where name = 'clinic-a'",
    );
    expect(rows[0]?.needs_admin_resume).toBe(true);
  });

  it('a read receipt for a message someone else sent never settles our send', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    await env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', {
      name: 'x',
      date: '2026-11-20',
      time: '09:30',
    });
    await env.drain('clinic-a');
    const sent = await env.query<{ wa_message_id: string }>(
      'select wa_message_id from s5.delivery_attempt',
    );
    const key = (sent[0]?.wa_message_id ?? '').split('_').pop() ?? '';
    await env.fakes.clinics?.ack('clinic-a', `false_${p.chatId}_${key}`, 3);
    const after = await env.query<{ status: string }>('select status from s5.delivery_attempt');
    expect(after.map((a) => a.status)).toEqual(['sent']);
  });

  it('acks that name the LID chat settle the send that named the phone', async () => {
    const env = track(await newEnv(pg.db));
    const p = await env.patient('c-a');
    env.fakes.clinics?.registerLid('clinic-a', '963980012345@lid', p.chatId);
    await env.fakes.clinics?.inbound('clinic-a', { from: p.chatId, body: 'مرحبا' });
    const r = await env.messaging.sendWhatsApp('c-a', p.patientId, 'appointment_reminder', {
      name: 'x',
      date: '2026-11-20',
      time: '09:30',
    });
    expect(r.status).toBe('queued');
    await env.drain('clinic-a');
    const sent = await env.query<{ wa_message_id: string }>(
      "select wa_message_id from s5.delivery_attempt where status = 'sent'",
    );
    const id = sent[0]?.wa_message_id ?? '';
    expect(id).toMatch(/@c\.us_/);
    await env.fakes.clinics?.ack('clinic-a', id, 3);
    const after = await env.query<{ status: string }>('select status from s5.delivery_attempt');
    expect(after.map((a) => a.status)).toEqual(['read']);
  });
});
