// Webhook bodies in the shapes the pinned WAHA documents (OpenAPI `webhooks` section and the
// events page): envelope with `evt_` ULID id, ms timestamp, session, me, payload, GOWS engine.
// 0.3-S5c checks them again against captures from the manual run.
import { randomBytes } from 'node:crypto';

export type EventName =
  | 'message'
  | 'message.ack'
  | 'message.edited'
  | 'message.revoked'
  | 'message.reaction'
  | 'session.status';

export type SessionStatus =
  | 'STOPPED'
  | 'STARTING'
  | 'SCAN_QR_CODE'
  | 'PASSKEY_REQUIRED'
  | 'PASSKEY_CONFIRMATION_REQUIRED'
  | 'WORKING'
  | 'FAILED';

export interface Me {
  id: string;
  pushName: string;
  lid: string;
  jid: string;
  reachoutTimelock: {
    enforcementType: string;
    isActive: boolean;
    timeEnforcementEnds: number | null;
  } | null;
  messageCapping: Record<string, unknown> | null;
}

export interface Envelope {
  id: string;
  timestamp: number;
  event: EventName;
  session: string;
  /** Null while the session is not linked (`STARTING`, `SCAN_QR_CODE`), as in the real run. */
  me: Me | null;
  payload: Record<string, unknown>;
  engine: 'GOWS';
  environment: {
    version: string;
    engine: 'GOWS';
    tier: 'CORE';
    browser: null;
    platform: string;
    worker: { id: null };
  };
}

/** The capping block the real WAHA sends on every event (manual day, 2026-11-19). */
export function cappingBlock(status: string, nowSeconds: number) {
  return {
    cappingStatus: status,
    totalQuota: status === 'NONE' ? -1 : 1000,
    usedQuota: status === 'NONE' ? 0 : 990,
    cycleStart: nowSeconds,
    cycleEnd: nowSeconds + 30 * 86_400,
    mvStatus: 'NOT_ELIGIBLE',
    oteStatus: 'NOT_ELIGIBLE',
  };
}

/** A linked account as the real `me` shows it: phone id, LID, device JID, no warnings. */
export function meOf(id: string, lid: string, pushName: string, nowSeconds = 1_795_000_000): Me {
  return {
    id,
    pushName,
    lid,
    jid: `${id.replace(/@c\.us$/, '')}:7@s.whatsapp.net`,
    reachoutTimelock: null,
    messageCapping: cappingBlock('NONE', nowSeconds),
  };
}

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';
/** Lower-case ULID-shaped id (time part + random part). */
export function ulid(now: number): string {
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = (CROCKFORD[t % 32] ?? '0') + time;
    t = Math.floor(t / 32);
  }
  const rand = [...randomBytes(16)].map((b) => CROCKFORD[b % 32] ?? '0').join('');
  return time + rand;
}

/** WhatsApp-style message key part: 20 upper-case hex characters. */
export const messageKey = () => randomBytes(10).toString('hex').toUpperCase();

export function envelope(
  event: EventName,
  session: string,
  me: Me | null,
  payload: Record<string, unknown>,
  now: number,
): Envelope {
  return {
    id: `evt_${ulid(now)}`,
    timestamp: now,
    event,
    session,
    me,
    payload,
    engine: 'GOWS',
    environment: {
      version: '2026.10.1',
      engine: 'GOWS',
      tier: 'CORE',
      browser: null,
      platform: 'linux/x64',
      worker: { id: null },
    },
  };
}

/** `session.status` payload; `data` carries capping when linked, the reason on a logout. */
export function statusPayload(
  name: string,
  status: SessionStatus,
  statuses: { status: SessionStatus; timestamp: number }[],
  options: {
    capping?: boolean;
    loggedOut?: boolean;
    timelock?: Me['reachoutTimelock'];
    nowSeconds?: number;
  } = {},
) {
  const data: Record<string, unknown> = {};
  if (options.capping) data['messageCapping'] = cappingBlock('NONE', options.nowSeconds ?? 0);
  if (options.loggedOut) data['reason'] = { OnConnect: false, Reason: 0, event: 'LoggedOut' };
  if (options.timelock?.isActive) data['reachoutTimelock'] = options.timelock;
  return { name, status, statuses, data: Object.keys(data).length > 0 ? data : null };
}

export type InboundKind = 'message' | 'edited' | 'revoked' | 'reaction';

export interface InboundInput {
  /** Chat id: `<digits>@c.us`, `<lid>@lid`, a group `@g.us` or a broadcast. */
  from: string;
  body?: string;
  kind?: InboundKind;
  participant?: string | undefined;
  fromMe?: boolean;
  /** A media message (the real one may carry a caption as `body`). */
  hasMedia?: boolean;
  /** Unix seconds; defaults to the fake's clock. */
  timestamp?: number;
}

/**
 * Inbound payloads in the real shape (manual day, 2026-11-19): `to` and `participant` are null
 * except in groups, `body` only on text, `_data` carries the engine's raw message. Group ids end
 * with the sender's `_<participant>`.
 */
export function inboundPayload(input: InboundInput, _meId: string, nowSeconds: number) {
  const { from, kind = 'message', fromMe = false } = input;
  const timestamp = input.timestamp ?? nowSeconds;
  const group = from.endsWith('@g.us');
  const participant = input.participant ?? null;
  const id = `${String(fromMe)}_${from}_${messageKey()}${group && participant ? `_${participant}` : ''}`;
  const head = { id, timestamp, from, fromMe, source: 'app' };
  const tail = { to: group ? from : null, participant: group ? participant : null };
  const message = () => ({
    ...head,
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...tail,
    hasMedia: input.hasMedia === true,
    media: null,
    ack: 2,
    location: null,
    vCards: null,
    ackName: 'DEVICE',
    replyTo: null,
    _data: {},
  });
  switch (kind) {
    case 'message':
      return { event: 'message' as const, payload: message() };
    case 'edited':
      return {
        event: 'message.edited' as const,
        payload: { ...message(), body: input.body ?? '', editedMessageId: messageKey() },
      };
    case 'revoked':
      return {
        event: 'message.revoked' as const,
        payload: { after: message(), before: null, revokedMessageId: messageKey(), _data: {} },
      };
    case 'reaction':
      return {
        event: 'message.reaction' as const,
        payload: {
          ...head,
          ...tail,
          reaction: { text: '👍', messageId: `false_${from}_${messageKey()}` },
        },
      };
  }
}

const ACK_NAMES: Record<number, string> = {
  [-1]: 'ERROR',
  0: 'PENDING',
  1: 'SERVER',
  2: 'DEVICE',
  3: 'READ',
  4: 'PLAYED',
};

/**
 * `message.ack` for one of our sent messages (`true_<chat>_<key>`). The real WAHA names the
 * recipient's `@lid` chat in acks although the send returned `<phone>@c.us` (manual day,
 * 2026-11-19): pass `lidChat` and the ack keeps only the key of the send.
 */
export function ackPayload(messageId: string, ack: number, error?: number, lidChat?: string) {
  // `false_…`: a read receipt the linked account sent for a message it received.
  const match = /^(true|false)_(.+)_([0-9A-Za-z]+)$/.exec(messageId);
  const fromMe = match?.[1] !== 'false';
  const chat = lidChat ?? match?.[2] ?? '';
  return {
    id: lidChat && match ? `${match[1] ?? 'true'}_${lidChat}_${match[3] ?? ''}` : messageId,
    from: chat,
    to: null,
    participant: null,
    fromMe,
    ack,
    ackName: ACK_NAMES[ack] ?? 'PENDING',
    // RN-10: ban codes come as "server returned error 463/475"; where GOWS puts the text in an
    // ack is confirmed by the manual run (0.3-S5c).
    _data: error === undefined ? {} : { error: `server returned error ${String(error)}` },
  };
}

export const banError = (code: number) => ({
  statusCode: 500,
  timestamp: new Date().toISOString(),
  exception: { message: `server returned error ${String(code)}`, name: 'Error' },
});
