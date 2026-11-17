// Spec "Money, abuse and privacy": the service, the fake and the real WAHA container never log
// a phone number, a message body, an API key or an HMAC key. The run plants markers in every
// one of them and searches all logs for them.
import { type Stack, startStack } from '@shifa-spike/s5-stack';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAdminPage } from '../src/admin-page.ts';
import { newEnv, useDatabase, useEnvs } from './harness.ts';
import { chatOf, issue, poll, sendToPlatform } from './verify-helpers.ts';

const pg = useDatabase();
const track = useEnvs();

let stack: Stack | undefined;
beforeAll(async () => {
  stack = await startStack({ waha: ['clinics'] });
});
afterAll(async () => {
  await stack?.stop();
});

const BODY_MARKER = 'سرّي-٤٢-علامة';

describe('no secrets in logs', () => {
  it('service and fake logs hold no number, body marker or key', async () => {
    const env = track(await newEnv(pg.db, { sendTimeoutMs: 200 }));
    const fake = env.fakes.clinics;
    const a = await env.patient('c-a');
    const b = await env.patient('c-a', { allowlisted: false });
    const lid = '204011500700321@lid';
    fake?.registerLid('clinic-a', lid, a.chatId);
    await fake?.inbound('clinic-a', { from: lid, body: `مرحبا ${BODY_MARKER}` });
    await fake?.inbound('clinic-a', { from: b.chatId, body: BODY_MARKER });
    const vars = { name: BODY_MARKER, date: '2026-11-18', time: '10:30' };
    await env.messaging.sendWhatsApp('c-a', a.patientId, 'appointment_reminder', vars);
    await env.messaging.sendWhatsApp('c-a', b.patientId, 'appointment_reminder', vars);
    await env.drain('clinic-a');
    fake?.setSendMode('clinic-a', 'timeout');
    await env.messaging.sendWhatsApp('c-a', a.patientId, 'appointment_reminder', vars);
    await env.drain('clinic-a');
    fake?.setSendMode('clinic-a', 'error463');
    await fake?.status('clinic-a', 'WORKING');
    await env.messaging.sendWhatsApp('c-a', a.patientId, 'appointment_reminder', vars);
    await env.drain('clinic-a');
    await fake?.inbound('clinic-a', { from: a.chatId, body: 'إيقاف' });
    await fake?.inbound('clinic-a', { from: a.chatId, body: 'x' }, { hmacKey: 'forged' });
    await env.messaging.runHealth();

    const text = env.logs.join('\n');
    expect(env.logs.length).toBeGreaterThan(5);
    const containerKeys = Object.values(env.config.containers).flatMap((c) => [
      c.apiKey,
      c.hmacKey,
    ]);
    for (const marker of [
      ...[a, b].flatMap((p) => [p.phone, p.phone.slice(1), p.phone.slice(4)]),
      lid.split('@')[0] ?? lid,
      BODY_MARKER,
      env.config.adminToken,
      ...containerKeys,
    ]) {
      expect(text.includes(marker), marker.slice(0, 3)).toBe(false);
    }
    expect(text).not.toMatch(/\d{8,}/);
  });

  it('service and fake logs hold no code, nonce, device secret or QR payload (0.3-S5b)', async () => {
    const env = track(await newEnv(pg.db));
    const phone = '+963930012345';
    env.allowlist.add(phone);
    const ok = await issue(env, 'device-3001', phone);
    await sendToPlatform(env, chatOf(phone), ok.text);
    await poll(env, ok.nonceId, { deviceId: 'device-3001', deviceSecret: ok.deviceSecret });
    const wrong = await issue(env, 'device-3002', phone);
    await sendToPlatform(env, chatOf('+963940054321'), wrong.text);
    await poll(env, wrong.nonceId, { deviceId: 'device-9999', deviceSecret: wrong.deviceSecret });
    await sendToPlatform(env, chatOf(phone), ok.text);

    await env.fakes.platform?.status('platform', 'SCAN_QR_CODE');
    const page = await startAdminPage(env.messaging);
    try {
      const res = await fetch(`${page.url}/api/sessions/platform/qr`, {
        headers: { 'x-admin-token': page.token },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      const qr = ((await res.json()) as { value: string }).value;
      expect(qr).toMatch(/^fake-qr-/);
      const refused = await fetch(`${page.url}/api/sessions/platform/qr`);
      expect(refused.status).toBe(401);

      const text = env.logs.join('\n');
      expect(env.logs.some((l) => l.includes('verify_attempt'))).toBe(true);
      for (const marker of [
        ok.code,
        wrong.code,
        ok.nonceId,
        wrong.nonceId,
        ok.deviceSecret,
        wrong.deviceSecret,
        qr,
        page.token,
        env.config.verify.serverKey,
        phone.slice(1),
      ]) {
        expect(text.includes(marker), marker.slice(0, 3)).toBe(false);
      }
      expect(text).not.toMatch(/\d{8,}/);
    } finally {
      await page.close();
    }
  });

  it('real WAHA container logs hold no API key, HMAC key or database password', async () => {
    if (!stack) throw new Error('stack');
    const waha = stack.waha.clinics;
    const logs = await stack.logs(waha.container);
    for (const secret of [waha.apiKey, waha.hmacKey, waha.dbPassword])
      expect(logs.includes(secret)).toBe(false);
    expect(logs).not.toMatch(/PASSWORD=/);
  });
});
