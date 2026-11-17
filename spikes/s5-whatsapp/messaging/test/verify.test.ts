// Criterion 9 (MSG-12, MSG-20, MSG-22, MSG-24): a phone is verified only by a code the patient
// sends to the platform number from the claimed phone, within 10 minutes, once. Every failure
// has its reason, recorded without the number; the device learns the result by polling with
// its secret; the platform replies once, in the same chat, only on success.
import { describe, expect, it } from 'vitest';
import { runDevice } from '../src/device.ts';
import { type Env, newEnv, PLATFORM_NUMBER, useDatabase, useEnvs } from './harness.ts';
import {
  chatOf,
  issue,
  outcomes,
  platformSends,
  poll,
  requestNonce,
  sendToPlatform,
} from './verify-helpers.ts';

const pg = useDatabase();
const track = useEnvs();

const phoneA = '+963930012345';
const phoneB = '+963940054321';
const phoneC = '+963950067890';

async function setup(): Promise<Env> {
  const env = track(await newEnv(pg.db));
  for (const p of [phoneA, phoneB, phoneC]) env.allowlist.add(p);
  return env;
}

const status = async (env: Env, nonceId: string, deviceId: string, deviceSecret: string) =>
  (await poll(env, nonceId, { deviceId, deviceSecret })).body['status'];

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const toArabicIndic = (s: string) => s.replace(/\d/g, (d) => ARABIC_INDIC[Number(d)] ?? d);

describe('reverse verification', () => {
  it('verifies the correct code from the claimed sender and replies once in the same chat', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0001', phoneA);
    expect(n.waLink.startsWith(`https://wa.me/${PLATFORM_NUMBER.slice(1)}?text=`)).toBe(true);
    expect(n.text).toBe(`رمز التحقق في شفاء: ${n.code}`);
    expect(n.code).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    expect(Date.parse(n.expiresAt) - env.clock.now()).toBe(600_000);
    expect(n.nonceId.length).toBeGreaterThanOrEqual(22);

    expect(await status(env, n.nonceId, 'device-0001', n.deviceSecret)).toBe('pending');
    const sent = await sendToPlatform(env, chatOf(phoneA), n.text);
    expect(sent.status).toBe(200);
    expect(await status(env, n.nonceId, 'device-0001', n.deviceSecret)).toBe('verified');

    const replies = platformSends(env);
    expect(replies).toHaveLength(1);
    expect(replies[0]?.chatId).toBe(chatOf(phoneA));
    expect(replies[0]?.replyTo).toBe(sent.messageId);
    expect(replies[0]?.text).toContain('تم التحقق');
    expect(await outcomes(env)).toEqual(['verified']);
  });

  it('accepts the code with extra text, lower case and Arabic-Indic digits', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0002', phoneA);
    const mangled = toArabicIndic(n.code.toLowerCase());
    await sendToPlatform(env, chatOf(phoneA), `مرحبا، هذا رمزي ${mangled} شكراً`);
    expect(await status(env, n.nonceId, 'device-0002', n.deviceSecret)).toBe('verified');
  });

  it('refuses an expired nonce', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0003', phoneA);
    env.clock.advance(600_001);
    await sendToPlatform(env, chatOf(phoneA), n.text);
    expect(await status(env, n.nonceId, 'device-0003', n.deviceSecret)).toBe('expired');
    expect(await outcomes(env)).toEqual(['expired']);
    expect(platformSends(env)).toEqual([]);
  });

  it('refuses polling by another device or without the device secret', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0004', phoneA);
    expect((await poll(env, n.nonceId, {})).status).toBe(401);
    expect((await poll(env, n.nonceId, { deviceId: 'device-0004' })).status).toBe(401);
    expect(
      (await poll(env, n.nonceId, { deviceId: 'device-0004', deviceSecret: 'x'.repeat(43) }))
        .status,
    ).toBe(401);
    const other = await poll(env, n.nonceId, {
      deviceId: 'device-9999',
      deviceSecret: n.deviceSecret,
    });
    expect(other.status).toBe(403);
    expect(await outcomes(env)).toEqual(['wrong_device']);
    expect(
      (await poll(env, 'no-such-nonce-id-000000', { deviceId: 'd', deviceSecret: 's' })).status,
    ).toBe(404);
  });

  it('refuses a code from another sender without consuming the nonce', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0005', phoneA);
    // A third number (B) sends A's code: refused, no reply, nonce still usable.
    await sendToPlatform(env, chatOf(phoneB), n.text);
    expect(await status(env, n.nonceId, 'device-0005', n.deviceSecret)).toBe('pending');
    expect(platformSends(env)).toEqual([]);
    await sendToPlatform(env, chatOf(phoneA), n.text);
    expect(await status(env, n.nonceId, 'device-0005', n.deviceSecret)).toBe('verified');
    expect(await outcomes(env)).toEqual(['sender_mismatch', 'verified']);
    const attempts = await env.query('select * from s5.verify_attempt');
    expect(JSON.stringify(attempts)).not.toContain(phoneA.slice(1));
    expect(JSON.stringify(attempts)).not.toContain(phoneB.slice(1));
  });

  it('refuses a reused code and does not reply again', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0006', phoneA);
    await sendToPlatform(env, chatOf(phoneA), n.text);
    await sendToPlatform(env, chatOf(phoneA), n.text);
    expect(await outcomes(env)).toEqual(['verified', 'reused']);
    expect(platformSends(env)).toHaveLength(1);
  });

  it('records an unknown code as no_match and ignores text without a code', async () => {
    const env = await setup();
    await issue(env, 'device-0007', phoneA);
    await sendToPlatform(env, chatOf(phoneA), 'رمز التحقق في شفاء: ZZZZZZ');
    await sendToPlatform(env, chatOf(phoneA), 'مرحبا');
    expect(await outcomes(env)).toEqual(['no_match']);
    expect(platformSends(env)).toEqual([]);
  });

  it('never counts edits, revokes or reactions as a code', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0008', phoneA);
    for (const kind of ['edited', 'revoked', 'reaction'] as const) {
      const res = await sendToPlatform(env, chatOf(phoneA), n.text, kind);
      expect(res.status, kind).toBe(200);
    }
    expect(await status(env, n.nonceId, 'device-0008', n.deviceSecret)).toBe('pending');
    expect(await outcomes(env)).toEqual([]);
    expect(platformSends(env)).toEqual([]);
  });

  it('ignores a code posted in a group or a broadcast', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0009', phoneA);
    const fake = env.fakes.platform;
    await fake?.inbound('platform', {
      from: '120363000000000001@g.us',
      participant: chatOf(phoneA),
      body: n.text,
    });
    await fake?.inbound('platform', { from: 'status@broadcast', body: n.text });
    expect(await status(env, n.nonceId, 'device-0009', n.deviceSecret)).toBe('pending');
  });

  it('rate-limits the sixth nonce request in an hour per device and per number', async () => {
    const env = await setup();
    for (let i = 0; i < 5; i++) {
      expect((await requestNonce(env, 'device-0010', `+96393001000${String(i)}`)).status).toBe(201);
    }
    const perDevice = await requestNonce(env, 'device-0010', phoneC);
    expect(perDevice.status).toBe(429);
    expect(perDevice.body['error']).toBe('rate_limited');

    for (let i = 0; i < 5; i++) {
      expect((await requestNonce(env, `device-01${String(i)}0`, phoneB)).status).toBe(201);
    }
    expect((await requestNonce(env, 'device-0199', phoneB)).status).toBe(429);

    env.clock.advance(3_600_001);
    expect((await requestNonce(env, 'device-0010', phoneC)).status).toBe(201);
  });

  it('rate-limits the sixth failed match in an hour per sender number', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0011', phoneA);
    for (let i = 0; i < 5; i++) await sendToPlatform(env, chatOf(phoneA), 'رمز: ZZZZZZ');
    // The right code now comes too late: the number is blocked for the hour.
    await sendToPlatform(env, chatOf(phoneA), n.text);
    expect(await status(env, n.nonceId, 'device-0011', n.deviceSecret)).toBe('pending');
    expect((await outcomes(env)).at(-1)).toBe('rate_limited');
    expect(platformSends(env)).toEqual([]);
  });

  it('rate-limits the sixth failed match in an hour per device', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0012', phoneA);
    // Five strangers send this device's code: each fails against the device's nonce.
    for (let i = 0; i < 5; i++)
      await sendToPlatform(env, chatOf(`+96395002000${String(i)}`), n.text);
    await sendToPlatform(env, chatOf(phoneA), n.text);
    expect(await status(env, n.nonceId, 'device-0012', n.deviceSecret)).toBe('pending');
    expect((await outcomes(env)).at(-1)).toBe('rate_limited');
  });

  it('resolves an @lid sender through the platform container first', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0013', phoneA);
    const lid = '204011500700555@lid';
    env.fakes.platform?.registerLid('platform', lid, chatOf(phoneA));
    await sendToPlatform(env, lid, n.text);
    expect(await status(env, n.nonceId, 'device-0013', n.deviceSecret)).toBe('verified');
    expect(env.fakes.platform?.calls.some((c) => c.path.startsWith('/api/platform/lids/'))).toBe(
      true,
    );
    expect(env.fakes.clinics?.calls.some((c) => c.path.includes('/lids/'))).toBe(false);
    // The reply goes back to the chat that wrote.
    expect(platformSends(env)[0]?.chatId).toBe(lid);
  });

  it('fails closed on an @lid sender that cannot be resolved', async () => {
    const env = await setup();
    const n = await issue(env, 'device-0014', phoneA);
    const lid = '204011500700556@lid';
    env.fakes.platform?.registerLid('platform', lid, null);
    await sendToPlatform(env, lid, n.text);
    expect(await status(env, n.nonceId, 'device-0014', n.deviceSecret)).toBe('pending');
    expect(await outcomes(env)).toEqual(['lid_unresolved']);
    expect(platformSends(env)).toEqual([]);
  });

  it('refuses malformed nonce requests', async () => {
    const env = await setup();
    for (const [deviceId, phone] of [
      ['device-0015', '0930012345'],
      ['device-0015', '+96393 0012345'],
      ['x', phoneA],
      ['device-0015', ''],
    ] as const) {
      expect((await requestNonce(env, deviceId, phone)).status, `${deviceId} ${phone}`).toBe(400);
    }
  });

  it('plays the device: link out, message in through the fake, verified by polling', async () => {
    const env = await setup();
    const links: string[] = [];
    const result = await runDevice({
      baseUrl: env.url,
      deviceId: 'device-0016',
      phone: phoneA,
      pollMs: 10,
      timeoutMs: 10_000,
      onLink: async (link, text) => {
        links.push(link);
        await sendToPlatform(env, chatOf(phoneA), text);
      },
    });
    expect(result).toEqual({ status: 'verified' });
    expect(links).toHaveLength(1);
  });
});
