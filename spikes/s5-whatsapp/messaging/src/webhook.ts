// Webhook router (criterion 1 webhook half, MSG-09): each WAHA container posts to its own path
// with its own HMAC key; WAHA signs the raw body only (HMAC-SHA512, hex). Refused with no side
// effect: unknown container, missing or wrong signature (401), a session that the posting
// container does not own or that does not exist (403). Exact replays are dropped by
// (container, event, id); ordering is handled per event (opt-in timestamps, forward-only acks).
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { handleAck } from './acks.ts';
import { tripBreaker, warningOf } from './breaker.ts';
import { type Ctx, loadSession, ts } from './context.ts';
import { setWahaStatus } from './fallback.ts';
import { type Inbound, recordInbound } from './optin.ts';
import { captureRaw } from './raw-capture.ts';
import { handlePlatformMessage, type PlatformMessage, platformReply } from './verify.ts';
import { isGroupOrBroadcast, phoneOfChat, wahaCall } from './waha.ts';

interface Envelope {
  id?: unknown;
  timestamp?: unknown;
  event?: unknown;
  session?: unknown;
  me?: unknown;
  payload?: Record<string, unknown>;
}

const INBOUND_EVENTS = new Set([
  'message',
  'message.edited',
  'message.revoked',
  'message.reaction',
]);

function signatureOk(raw: Buffer, given: unknown, key: string): boolean {
  if (typeof given !== 'string' || !/^[0-9a-f]{128}$/i.test(given)) return false;
  const expected = createHmac('sha512', key).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(given, 'hex'));
}

/** Sender, direction and time of an inbound event, in the shape each event documents. */
function inboundParts(event: string, envelope: Envelope) {
  const p = envelope.payload ?? {};
  const src = (event === 'message.revoked' ? (p['after'] ?? {}) : p) as Record<string, unknown>;
  const idParts =
    typeof src['id'] === 'string' ? /^(true|false)_(.+)_[^_]+$/.exec(src['id']) : null;
  const from = typeof src['from'] === 'string' ? src['from'] : (idParts?.[2] ?? '');
  const fromMe = src['fromMe'] === true || idParts?.[1] === 'true';
  const envelopeSeconds =
    typeof envelope.timestamp === 'number' ? Math.floor(envelope.timestamp / 1000) : 0;
  const timestamp =
    typeof src['timestamp'] === 'number' ? Math.floor(src['timestamp']) : envelopeSeconds;
  const text = event === 'message' && typeof p['body'] === 'string' ? p['body'] : null;
  return { from, fromMe, timestamp, text };
}

/** The dedupe key: an exact replay of an event maps to the same key. */
function dedupeKey(event: string, envelope: Envelope): string {
  const p = envelope.payload ?? {};
  if (event === 'message.ack') return `${event}:${String(p['id'])}:${String(p['ack'])}`;
  if (event === 'message.revoked')
    return `${event}:${String((p['after'] as { id?: unknown } | undefined)?.id)}`;
  if (INBOUND_EVENTS.has(event) && typeof p['id'] === 'string') return `${event}:${p['id']}`;
  return `${event}:${String(envelope.id)}`;
}

export function registerWebhooks(app: FastifyInstance, ctx: Ctx) {
  app.post<{ Params: { container: string } }>('/webhooks/:container', async (request, reply) => {
    const container = request.params.container;
    const conf = Object.hasOwn(ctx.config.containers, container)
      ? ctx.config.containers[container]
      : undefined;
    const raw = request.body as Buffer;
    if (!conf) {
      ctx.log('webhook_refused', { reason: 'unknown_container' });
      return reply.code(404).send({ error: 'unknown container' });
    }
    if (ctx.config.rawCaptureDir && Buffer.isBuffer(raw)) {
      try {
        captureRaw(ctx.config.rawCaptureDir, container, request.headers, raw, ctx.deps.now());
      } catch {
        ctx.log('raw_capture_failed', { container });
      }
    }
    if (
      !Buffer.isBuffer(raw) ||
      !signatureOk(raw, request.headers['x-webhook-hmac'], conf.hmacKey)
    ) {
      ctx.log('webhook_refused', { container, reason: 'signature' });
      return reply.code(401).send({ error: 'signature' });
    }
    const envelope = JSON.parse(raw.toString('utf8')) as Envelope;
    const event = typeof envelope.event === 'string' ? envelope.event : '';
    const name = typeof envelope.session === 'string' ? envelope.session : '';
    const session = await ctx.db.tx((client) => loadSession(client, name));
    if (session?.container !== container) {
      ctx.log('webhook_refused', { container, reason: 'session_not_owned' });
      return reply.code(403).send({ error: 'session' });
    }

    // Network work (LID lookup) before the transaction. (container, session) alone decides the
    // role: platform messages go to verification only, clinic messages to that clinic's opt-in
    // only (MSG-09).
    let inbound: Inbound | null = null;
    let platformMessage: PlatformMessage | null = null;
    if (INBOUND_EVENTS.has(event)) {
      const parts = inboundParts(event, envelope);
      if (!parts.fromMe && !isGroupOrBroadcast(parts.from) && parts.from !== '') {
        let chat: string | null = parts.from;
        if (parts.from.endsWith('@lid')) {
          const res = await wahaCall(
            conf,
            'GET',
            `/api/${encodeURIComponent(name)}/lids/${encodeURIComponent(parts.from)}`,
            undefined,
            ctx.config.sendTimeoutMs,
          );
          // A lookup that failed (timeout, cut connection, 5xx) is not an answer: refuse without
          // recording the event, so WAHA's webhook retries deliver it again (an opt-out must
          // not be lost). Only "answered, no phone number" is unresolvable (fails closed).
          if (res.kind !== 'ok' && !(res.kind === 'http' && res.status < 500)) {
            ctx.log('lid_lookup_failed', { session: name, reason: res.kind });
            return reply.code(503).send({ error: 'lid lookup failed' });
          }
          chat = res.kind === 'ok' && typeof res.json['pn'] === 'string' ? res.json['pn'] : null;
          if (!chat) ctx.log('lid_unresolved', { session: name });
        }
        const phone = chat ? phoneOfChat(chat) : null;
        const messageId = envelope.payload?.['id'];
        if (session.role === 'platform') {
          // Only plain messages can carry a code; edits, revokes and reactions never do.
          if (event === 'message' && typeof messageId === 'string') {
            platformMessage = { messageId, chatId: parts.from, phone, text: parts.text ?? '' };
          }
        } else if (phone) {
          inbound = { phone, timestamp: parts.timestamp, keywordText: parts.text };
        }
      }
    }

    const { kicks, replyTo } = await ctx.db.tx(async (client) => {
      const seen = await client.query(
        'insert into s5.webhook_seen (container, key, seen_at) values ($1, $2, $3) on conflict do nothing',
        [container, dedupeKey(event, envelope), ts(ctx)],
      );
      if (seen.rowCount === 0) {
        ctx.log('webhook_duplicate', { container, session: name, reason: event });
        return { kicks: [] as string[], replyTo: null };
      }
      const out: string[] = [];
      let answer: string | null = null;
      if (platformMessage) {
        answer = await handlePlatformMessage(ctx, client, session, platformMessage);
      } else if (inbound) {
        const kick = await recordInbound(ctx, client, session, inbound);
        if (kick) out.push(kick);
      } else if (event === 'message.ack') {
        await handleAck(ctx, client, name, envelope.payload ?? {});
      } else if (event === 'session.status') {
        const status = envelope.payload?.['status'];
        const warning = warningOf(envelope);
        if (warning) await tripBreaker(ctx, client, name, warning);
        if (typeof status === 'string') await setWahaStatus(ctx, client, name, status, true);
        if (status === 'WORKING') out.push(name);
      }
      return { kicks: out, replyTo: answer };
    });
    for (const s of kicks) await ctx.kick(s);
    if (replyTo) await platformReply(ctx, { session: name, replyTo });
    return reply.code(200).send({ ok: true });
  });
}
