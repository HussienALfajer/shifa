// Criterion 9, last sentence (MSG-22): the platform number never initiates. After a run of
// every verification path plus clinic traffic, each platform outbound replies to an inbound
// message on that session less than 10 minutes old, from an allowlisted number; inbound without
// a valid code gets no reply; the platform send has no form without `replyTo`.
import type { FakeCall } from '@shifa-spike/s5-fake-waha';
import { describe, expect, it } from 'vitest';
import { platformReply } from '../src/verify.ts';
import { type Env, newEnv, useDatabase, useEnvs } from './harness.ts';
import { chatOf, issue, platformSends, sendToPlatform } from './verify-helpers.ts';

const pg = useDatabase();
const track = useEnvs();

const phoneA = '+963930012345';
const phoneB = '+963940054321';
const stranger = '+963960077777';

interface InboundSeen {
  messageId: string;
  chatId: string;
  clock: number;
}

/** Sends to the platform number and remembers what arrived, with the fake's clock. */
async function send(env: Env, seen: InboundSeen[], chatId: string, body: string) {
  const clock = env.clock.now();
  const res = await sendToPlatform(env, chatId, body);
  expect(res.status).toBe(200);
  seen.push({ messageId: res.messageId, chatId, clock });
  return res;
}

function assertEveryOutboundIsAReply(
  calls: FakeCall[],
  seen: InboundSeen[],
  allowlisted: Set<string>,
  lids: Map<string, string>,
) {
  for (const call of calls.filter((c) => c.method === 'POST' && c.path === '/api/sendText')) {
    expect(call.session).toBe('platform');
    const inbound = seen.find((s) => s.messageId === call.replyTo);
    expect(inbound, 'reply_to names an inbound message on this session').toBeDefined();
    if (!inbound) continue;
    expect(call.chatId).toBe(inbound.chatId);
    expect(call.clock - inbound.clock).toBeLessThan(600_000);
    expect(call.clock - inbound.clock).toBeGreaterThanOrEqual(0);
    const chat = lids.get(inbound.chatId) ?? inbound.chatId;
    expect(allowlisted.has(`+${chat.split('@')[0] ?? ''}`)).toBe(true);
  }
}

describe('platform never initiates', () => {
  it('only replies, within 10 minutes, to allowlisted senders who sent a valid code', async () => {
    const env = track(await newEnv(pg.db));
    env.allowlist.add(phoneA);
    env.allowlist.add(phoneB);
    const seen: InboundSeen[] = [];
    const lids = new Map<string, string>();

    // Success, plain.
    const a = await issue(env, 'device-1001', phoneA);
    await send(env, seen, chatOf(phoneA), a.text);
    // Reused, sender mismatch, unknown code, plain chatter: no reply.
    await send(env, seen, chatOf(phoneA), a.text);
    const b = await issue(env, 'device-1002', phoneB);
    await send(env, seen, chatOf(phoneA), b.text);
    await send(env, seen, chatOf(phoneB), 'رمز: ZZZZZZ');
    await send(env, seen, chatOf(phoneB), 'مرحبا');
    // Expired: no reply.
    const late = await issue(env, 'device-1003', phoneB);
    env.clock.advance(600_001);
    await send(env, seen, chatOf(phoneB), late.text);
    // Valid code from a number that is not on the allowlist: verified, but no reply (MSG-32).
    const s = await issue(env, 'device-1004', stranger);
    await send(env, seen, chatOf(stranger), s.text);
    // Success through a resolved @lid.
    const lid = '204011500700777@lid';
    lids.set(lid, chatOf(phoneB));
    env.fakes.platform?.registerLid('platform', lid, chatOf(phoneB));
    const viaLid = await issue(env, 'device-1005', phoneB);
    await send(env, seen, lid, viaLid.text);
    // Session events and clinic traffic never make the platform send.
    await env.fakes.platform?.status('platform', 'STOPPED');
    await env.fakes.platform?.status('platform', 'WORKING');
    await env.fakes.clinics?.inbound('clinic-a', { from: chatOf(phoneA), body: a.text });
    await env.messaging.runHealth();
    await env.drain('platform');

    const sends = platformSends(env);
    expect(sends).toHaveLength(2);
    const allowlisted = new Set(env.allowlist);
    assertEveryOutboundIsAReply(env.fakes.platform?.calls ?? [], seen, allowlisted, lids);
    // Seen and typing are not messages, but the platform makes no other calls that write to a chat.
    const writes = (env.fakes.platform?.calls ?? []).filter(
      (c) => c.method === 'POST' && c.path !== '/api/sendText' && c.chatId !== undefined,
    );
    expect(writes).toEqual([]);
    const stored = await env.query<{ status: string }>(
      'select status from s5.platform_outbound order by id',
    );
    // A, the stranger (verified, reply refused by the allowlist), the @lid sender.
    expect(stored.map((r) => r.status)).toEqual(['sent', 'refused', 'sent']);
  });

  it('refuses a reply to an inbound older than 10 minutes, on another session, or unknown', async () => {
    const env = track(await newEnv(pg.db));
    env.allowlist.add(phoneA);
    const old = await sendToPlatform(env, chatOf(phoneA), 'مرحبا');
    env.clock.advance(600_001);
    expect(
      await platformReply(env.messaging.ctx, { session: 'platform', replyTo: old.messageId }),
    ).toBe('refused');
    const fresh = await sendToPlatform(env, chatOf(phoneA), 'مرحبا');
    expect(
      await platformReply(env.messaging.ctx, { session: 'clinic-a', replyTo: fresh.messageId }),
    ).toBe('refused');
    expect(
      await platformReply(env.messaging.ctx, {
        session: 'platform',
        replyTo: 'false_x@c.us_ABCDEF',
      }),
    ).toBe('refused');
    // A clinic inbound is not a platform inbound, even when its id is passed.
    const clinic = await env.fakes.clinics?.inbound('clinic-a', {
      from: chatOf(phoneA),
      body: 'مرحبا',
    });
    expect(
      await platformReply(env.messaging.ctx, {
        session: 'platform',
        replyTo: clinic?.messageId ?? '',
      }),
    ).toBe('refused');
    expect(platformSends(env)).toEqual([]);
  });

  it('has no platform send without replyTo: a type error and a runtime refusal', async () => {
    const env = track(await newEnv(pg.db));
    // @ts-expect-error -- replyTo is required: the platform cannot start a conversation.
    const result = await platformReply(env.messaging.ctx, { session: 'platform' });
    expect(result).toBe('refused');
    expect(platformSends(env)).toEqual([]);
  });
});
