// Spec "Money, abuse and privacy": the service, the fake and the real WAHA container never log
// a phone number, a message body, an API key or an HMAC key. The run plants markers in every
// one of them and searches all logs for them.
import { type Stack, startStack } from '@shifa-spike/s5-stack';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newEnv, useDatabase, useEnvs } from './harness.ts';

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

  it('real WAHA container logs hold no API key, HMAC key or database password', async () => {
    if (!stack) throw new Error('stack');
    const waha = stack.waha.clinics;
    const logs = await stack.logs(waha.container);
    for (const secret of [waha.apiKey, waha.hmacKey, waha.dbPassword])
      expect(logs.includes(secret)).toBe(false);
    expect(logs).not.toMatch(/PASSWORD=/);
  });
});
