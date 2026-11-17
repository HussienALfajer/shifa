// Reverse verification (criterion 9, MSG-12, MSG-20, MSG-22, MSG-24): the device asks for a
// nonce bound to itself and the claimed number and gets a `wa.me` link to the platform number
// with the prefilled code; the patient sends it; the platform webhook matches code and sender,
// marks the nonce verified and replies once in the same chat. The device polls with its secret.
// Limits: 5 nonce requests and 5 failed matches per device and per number per hour. A code from
// another sender is refused without consuming the nonce; an unresolvable @lid fails closed.
import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { type Ctx, type SessionRow, ts } from './context.ts';
import { type Client, rows } from './db.ts';
import {
  codeKey,
  DEVICE_ID,
  E164,
  extractCode,
  newCode,
  phoneKey,
  prefilledText,
  secretHash,
  secretMatches,
  waLink,
} from './verify-code.ts';

export { type PlatformReply, platformReply } from './platform-reply.ts';

export const NONCE_TTL_MS = 600_000;
export const LIMIT_WINDOW_MS = 3_600_000;
export const LIMIT = 5;

export type Outcome =
  | 'verified'
  | 'expired'
  | 'wrong_device'
  | 'sender_mismatch'
  | 'reused'
  | 'rate_limited'
  | 'lid_unresolved'
  | 'no_match';

/** One inbound text message on the platform session, after @lid resolution. */
export interface PlatformMessage {
  messageId: string;
  /** The chat that wrote (a phone JID or an @lid): where a reply goes. */
  chatId: string;
  /** Resolved E.164 number; null when an @lid could not be resolved. */
  phone: string | null;
  text: string;
}

interface NonceRow {
  id: string;
  device_id: string;
  phone_key: string;
  secret_hash: string;
  expires_at: string;
  verified_at: string | null;
}

async function recordAttempt(
  ctx: Ctx,
  client: Client,
  outcome: Outcome,
  keys: { nonceId?: string; deviceId?: string; senderKey?: string | null; claimedKey?: string },
) {
  await client.query(
    `insert into s5.verify_attempt (nonce_id, device_id, sender_key, claimed_key, outcome, created_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      keys.nonceId ?? null,
      keys.deviceId ?? null,
      keys.senderKey ?? null,
      keys.claimedKey ?? null,
      outcome,
      ts(ctx),
    ],
  );
  ctx.log('verify_attempt', { reason: outcome });
}

/** Failed matches in the last hour against this sender, the claimed number or the device. */
async function recentFailures(
  ctx: Ctx,
  client: Client,
  senderKey: string | null,
  nonce: NonceRow | undefined,
): Promise<number> {
  const since = ts(ctx, ctx.deps.now() - LIMIT_WINDOW_MS);
  const keys = [senderKey, nonce?.phone_key].filter((k): k is string => typeof k === 'string');
  const counts = await rows<{ n: number }>(
    client,
    `select count(*)::int as n from s5.verify_attempt
     where outcome <> 'verified' and created_at > $1
       and (sender_key = any($2) or claimed_key = any($2) or device_id = $3)`,
    [since, keys, nonce?.device_id ?? null],
  );
  return counts[0]?.n ?? 0;
}

/**
 * Matches a platform message inside the webhook's transaction. Returns the inbound id to reply
 * to after commit, only on a successful verification.
 */
export async function handlePlatformMessage(
  ctx: Ctx,
  client: Client,
  session: SessionRow,
  msg: PlatformMessage,
): Promise<string | null> {
  await client.query(
    'update s5.session set last_ok_at = greatest(last_ok_at, $2), not_seen_alerted = false where name = $1',
    [session.name, ts(ctx)],
  );
  await client.query(
    `insert into s5.platform_inbound (message_id, session, chat_id, phone, received_at)
     values ($1, $2, $3, $4, $5) on conflict do nothing`,
    [msg.messageId, session.name, msg.chatId, msg.phone, ts(ctx)],
  );
  const code = extractCode(msg.text);
  if (!code) return null;
  const key = ctx.config.verify.serverKey;
  const senderKey = msg.phone ? phoneKey(key, msg.phone) : null;
  const nonce = (
    await rows<NonceRow>(client, 'select * from s5.verify_nonce where code_hash = $1 for update', [
      codeKey(key, code),
    ])
  )[0];
  const keys = {
    senderKey,
    ...(nonce ? { nonceId: nonce.id, deviceId: nonce.device_id, claimedKey: nonce.phone_key } : {}),
  };
  let outcome: Outcome;
  if ((await recentFailures(ctx, client, senderKey, nonce)) >= LIMIT) outcome = 'rate_limited';
  else if (!nonce) outcome = 'no_match';
  else if (nonce.verified_at) outcome = 'reused';
  else if (ctx.deps.now() > Date.parse(nonce.expires_at)) outcome = 'expired';
  else if (!senderKey) outcome = 'lid_unresolved';
  else if (senderKey !== nonce.phone_key) outcome = 'sender_mismatch';
  else outcome = 'verified';
  if (outcome === 'verified' && nonce) {
    await client.query('update s5.verify_nonce set verified_at = $2 where id = $1', [
      nonce.id,
      ts(ctx),
    ]);
  }
  await recordAttempt(ctx, client, outcome, keys);
  return outcome === 'verified' ? msg.messageId : null;
}

function parseJson(body: unknown): Record<string, unknown> | null {
  if (!Buffer.isBuffer(body)) return null;
  try {
    const value: unknown = JSON.parse(body.toString('utf8'));
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type Issue =
  | { kind: 'rate_limited' }
  | { kind: 'issued'; nonceId: string; deviceSecret: string; code: string; expiresAt: string };

async function issueNonce(ctx: Ctx, deviceId: string, phone: string): Promise<Issue> {
  const pk = phoneKey(ctx.config.verify.serverKey, phone);
  return ctx.db.tx(async (client) => {
    // Serialises requests per device and per number, so the limits hold under concurrency.
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`device:${deviceId}`]);
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`phone:${pk}`]);
    const since = ts(ctx, ctx.deps.now() - LIMIT_WINDOW_MS);
    const counts = await rows<{ by_device: number; by_phone: number }>(
      client,
      `select count(*) filter (where device_id = $1)::int as by_device,
              count(*) filter (where phone_key = $2)::int as by_phone
       from s5.verify_nonce where created_at > $3`,
      [deviceId, pk, since],
    );
    const c = counts[0];
    if (c && (c.by_device >= LIMIT || c.by_phone >= LIMIT)) return { kind: 'rate_limited' };
    const nonceId = randomBytes(16).toString('base64url');
    const deviceSecret = randomBytes(32).toString('base64url');
    const expiresAt = ts(ctx, ctx.deps.now() + NONCE_TTL_MS);
    for (let i = 0; i < 5; i++) {
      const code = newCode();
      const inserted = await client.query(
        `insert into s5.verify_nonce (id, device_id, phone_key, code_hash, secret_hash, created_at, expires_at)
         values ($1, $2, $3, $4, $5, $6, $7) on conflict (code_hash) do nothing`,
        [
          nonceId,
          deviceId,
          pk,
          codeKey(ctx.config.verify.serverKey, code),
          secretHash(deviceSecret),
          ts(ctx),
          expiresAt,
        ],
      );
      if (inserted.rowCount === 1)
        return { kind: 'issued', nonceId, deviceSecret, code, expiresAt };
    }
    throw new Error('no free code');
  });
}

export function registerVerify(app: FastifyInstance, ctx: Ctx) {
  app.post('/verify/nonce', async (request, reply) => {
    const body = parseJson(request.body);
    const deviceId = body?.['deviceId'];
    const phone = body?.['phone'];
    if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) {
      return reply.code(400).send({ error: 'deviceId' });
    }
    if (typeof phone !== 'string' || !E164.test(phone)) {
      return reply.code(400).send({ error: 'phone' });
    }
    const result = await issueNonce(ctx, deviceId, phone);
    if (result.kind === 'rate_limited') {
      ctx.log('verify_nonce_refused', { reason: 'rate_limited' });
      return reply.code(429).send({ error: 'rate_limited' });
    }
    ctx.log('verify_nonce_issued');
    return reply.code(201).send({
      nonceId: result.nonceId,
      deviceSecret: result.deviceSecret,
      waLink: waLink(ctx.config.verify.platformNumber, result.code),
      text: prefilledText(result.code),
      expiresAt: result.expiresAt,
    });
  });

  app.get<{ Params: { nonceId: string } }>('/verify/:nonceId', async (request, reply) => {
    const deviceId = request.headers['x-device-id'];
    const secret = request.headers['x-device-secret'];
    if (typeof deviceId !== 'string' || typeof secret !== 'string') {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const answer = await ctx.db.tx(async (client) => {
      const nonce = (
        await rows<NonceRow>(client, 'select * from s5.verify_nonce where id = $1', [
          request.params.nonceId,
        ])
      )[0];
      if (!nonce) return { code: 404, body: { error: 'unknown' } };
      if (!secretMatches(secret, nonce.secret_hash)) {
        return { code: 401, body: { error: 'unauthorized' } };
      }
      if (nonce.device_id !== deviceId) {
        await recordAttempt(ctx, client, 'wrong_device', {
          nonceId: nonce.id,
          deviceId: nonce.device_id,
          claimedKey: nonce.phone_key,
        });
        return { code: 403, body: { error: 'wrong_device' } };
      }
      const status = nonce.verified_at
        ? 'verified'
        : ctx.deps.now() > Date.parse(nonce.expires_at)
          ? 'expired'
          : 'pending';
      const last = (
        await rows<{ outcome: string }>(
          client,
          'select outcome from s5.verify_attempt where nonce_id = $1 order by id desc limit 1',
          [nonce.id],
        )
      )[0];
      return {
        code: 200,
        body: status === 'pending' && last ? { status, lastFailure: last.outcome } : { status },
      };
    });
    return reply.code(answer.code).send(answer.body);
  });
}
