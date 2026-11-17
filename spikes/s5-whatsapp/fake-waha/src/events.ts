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
  reachoutTimelock?: {
    enforcementType: string;
    isActive: boolean;
    timeEnforcementEnds: number | null;
  } | null;
  messageCapping?: Record<string, unknown> | null;
}

export interface Envelope {
  id: string;
  timestamp: number;
  event: EventName;
  session: string;
  metadata: Record<string, string>;
  me: Me;
  payload: Record<string, unknown>;
  engine: 'GOWS';
  environment: { version: string; engine: 'GOWS'; tier: 'CORE'; browser: null };
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
  me: Me,
  payload: Record<string, unknown>,
  now: number,
): Envelope {
  return {
    id: `evt_${ulid(now)}`,
    timestamp: now,
    event,
    session,
    metadata: {},
    me,
    payload,
    engine: 'GOWS',
    environment: { version: '2026.10.1', engine: 'GOWS', tier: 'CORE', browser: null },
  };
}

export type InboundKind = 'message' | 'edited' | 'revoked' | 'reaction';

export interface InboundInput {
  /** Chat id: `<digits>@c.us`, `<lid>@lid`, a group `@g.us` or a broadcast. */
  from: string;
  body?: string;
  kind?: InboundKind;
  participant?: string;
  fromMe?: boolean;
  /** Unix seconds; defaults to the fake's clock. */
  timestamp?: number;
}

export function inboundPayload(input: InboundInput, meId: string, nowSeconds: number) {
  const { from, kind = 'message', fromMe = false } = input;
  const timestamp = input.timestamp ?? nowSeconds;
  const id = `${String(fromMe)}_${from}_${messageKey()}`;
  const base = { id, timestamp, from, fromMe, to: meId, _data: {} } as Record<string, unknown>;
  if (input.participant) base['participant'] = input.participant;
  switch (kind) {
    case 'message':
      return {
        event: 'message' as const,
        payload: {
          ...base,
          source: 'app',
          body: input.body ?? '',
          hasMedia: false,
          ack: 2,
          vCards: [],
        },
      };
    case 'edited':
      return {
        event: 'message.edited' as const,
        payload: { ...base, body: input.body ?? '', editedMessageId: messageKey() },
      };
    case 'revoked':
      return {
        event: 'message.revoked' as const,
        payload: { after: base, revokedMessageId: messageKey(), before: null },
      };
    case 'reaction':
      return {
        event: 'message.reaction' as const,
        payload: {
          ...base,
          participant: input.participant ?? from,
          reaction: { text: '👍', messageId: `true_${from}_${messageKey()}` },
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

/** `message.ack` for one of our sent messages (`true_<chat>_<key>`). */
export function ackPayload(messageId: string, ack: number, error?: number) {
  const chat = /^true_(.+)_[0-9A-F]+$/.exec(messageId)?.[1] ?? '';
  return {
    id: messageId,
    from: chat,
    to: chat,
    participant: null,
    fromMe: true,
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
