// The platform session's only send (criterion 9, MSG-22): a reply to an inbound message that
// arrived on that same session less than 10 minutes ago, to the chat that wrote, once per inbound,
// only to an allowlisted number (MSG-32). There is no form without `replyTo`: the type requires
// it and a call without it is refused at runtime. The verifier calls it only after a successful
// verification, so a stranger cannot make the platform send. A timeout is "unknown", never retried.
import { type Ctx, loadSession, sendable, ts } from './context.ts';
import { rows } from './db.ts';
import { wahaCall } from './waha.ts';

export const REPLY_WINDOW_MS = 600_000;
export const VERIFIED_REPLY = 'تم التحقق من رقمك في شفاء. يمكنك العودة إلى التطبيق.';

export interface PlatformReply {
  session: string;
  /** Id of the inbound message this answers (WAHA `reply_to`). */
  replyTo: string;
}

export type ReplyResult = 'sent' | 'refused' | 'failed' | 'unknown';

interface InboundRow {
  message_id: string;
  chat_id: string;
  phone: string | null;
  received_at: string;
}

export async function platformReply(ctx: Ctx, reply: PlatformReply): Promise<ReplyResult> {
  const replyTo: unknown = (reply as Partial<PlatformReply> | undefined)?.replyTo;
  const sessionName: unknown = (reply as Partial<PlatformReply> | undefined)?.session;
  if (typeof replyTo !== 'string' || replyTo === '' || typeof sessionName !== 'string') {
    ctx.log('platform_send_refused', { reason: 'no_reply_to' });
    return 'refused';
  }
  const prepared = await ctx.db.tx(async (client) => {
    const session = await loadSession(client, sessionName);
    if (session?.role !== 'platform') return { refused: 'not_platform' } as const;
    const inbound = (
      await rows<InboundRow>(
        client,
        'select * from s5.platform_inbound where message_id = $1 and session = $2 for update',
        [replyTo, sessionName],
      )
    )[0];
    if (!inbound) return { refused: 'unknown_inbound' } as const;
    const refuse = async (reason: string) => {
      await client.query(
        `insert into s5.platform_outbound (session, reply_to, status, reason, created_at, updated_at)
         values ($1, $2, 'refused', $3, $4, $4)`,
        [sessionName, replyTo, reason, ts(ctx)],
      );
      return { refused: reason } as const;
    };
    if (ctx.deps.now() - Date.parse(inbound.received_at) >= REPLY_WINDOW_MS) {
      return refuse('too_old');
    }
    const earlier = await rows(
      client,
      "select 1 from s5.platform_outbound where reply_to = $1 and status <> 'refused'",
      [replyTo],
    );
    if (earlier.length > 0) return refuse('already_replied');
    if (!inbound.phone || !ctx.config.allowlist.has(inbound.phone)) return refuse('allowlist');
    if (!sendable(session)) return refuse('not_sendable');
    const id = await rows<{ id: string }>(
      client,
      `insert into s5.platform_outbound (session, reply_to, status, created_at, updated_at)
       values ($1, $2, 'sending', $3, $3) returning id`,
      [sessionName, replyTo, ts(ctx)],
    );
    return { id: id[0]?.id ?? '', chatId: inbound.chat_id, container: session.container };
  });
  if ('refused' in prepared) {
    ctx.log('platform_send_refused', { session: sessionName, reason: prepared.refused });
    return 'refused';
  }
  const conf = ctx.config.containers[prepared.container];
  if (!conf) return 'refused';
  const res = await wahaCall(
    conf,
    'POST',
    '/api/sendText',
    { session: sessionName, chatId: prepared.chatId, text: VERIFIED_REPLY, reply_to: replyTo },
    ctx.config.sendTimeoutMs,
  );
  const status: ReplyResult =
    res.kind === 'ok'
      ? 'sent'
      : res.kind === 'timeout' || res.kind === 'network'
        ? 'unknown'
        : 'failed';
  const waId = res.kind === 'ok' && typeof res.json['id'] === 'string' ? res.json['id'] : null;
  await ctx.db.query(
    'update s5.platform_outbound set status = $2, wa_message_id = $3, updated_at = $4 where id = $1',
    [prepared.id, status, waId, ts(ctx)],
  );
  ctx.log('platform_reply', { session: sessionName, status });
  return status;
}
