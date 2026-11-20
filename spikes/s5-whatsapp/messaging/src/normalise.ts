// What the service reads from a WAHA webhook body, as pure functions (criterion 2): `webhook.ts`
// routes with them, and the fixture replay (`fake-waha/test/fixture-replay.test.ts`) runs every
// real body from the manual day and the fake's twin through `normaliseEvent`.
// Manual day (2026-11-19): every inbound chat arrived as `@lid`; acks of our own sends name the
// `@lid` chat while the send returned `<phone>@c.us`, with the same message key.

export interface EnvelopeLike {
  id?: unknown;
  timestamp?: unknown;
  event?: unknown;
  session?: unknown;
  me?: unknown;
  payload?: unknown;
}

export type ChatKind = 'phone' | 'lid' | 'group' | 'newsletter' | 'broadcast' | 'none' | 'other';

export function chatKind(chat: unknown): ChatKind {
  if (typeof chat !== 'string' || chat === '') return 'none';
  if (/^\d{6,15}@(c\.us|s\.whatsapp\.net)$/.test(chat)) return 'phone';
  if (/^\d+@lid$/.test(chat)) return 'lid';
  if (chat.endsWith('@g.us')) return 'group';
  if (chat.endsWith('@newsletter')) return 'newsletter';
  if (chat.endsWith('@broadcast')) return 'broadcast';
  return 'other';
}

/** `true|false_<chat>_<key>`, with a `_<participant>` suffix in groups. */
const MESSAGE_ID = /^(true|false)_([^_]+@[a-z.]+)_([0-9A-Za-z]+)(?:_[^_]+@[a-z.]+)?$/;

/** The key part of a message id (what an ack and its send share). */
export function messageKeyOf(id: string): string | null {
  return MESSAGE_ID.exec(id)?.[3] ?? null;
}

const record = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Sender, direction and time of an inbound event, in the shape each event documents. */
export function inboundParts(event: string, envelope: EnvelopeLike) {
  const p = record(envelope.payload);
  const src = event === 'message.revoked' ? record(p['after']) : p;
  const idParts = typeof src['id'] === 'string' ? MESSAGE_ID.exec(src['id']) : null;
  const from = typeof src['from'] === 'string' ? src['from'] : (idParts?.[2] ?? '');
  const fromMe = src['fromMe'] === true || idParts?.[1] === 'true';
  const envelopeSeconds =
    typeof envelope.timestamp === 'number' ? Math.floor(envelope.timestamp / 1000) : 0;
  const timestamp =
    typeof src['timestamp'] === 'number' ? Math.floor(src['timestamp']) : envelopeSeconds;
  const text = event === 'message' && typeof p['body'] === 'string' ? p['body'] : null;
  return { from, fromMe, timestamp, text, idOk: idParts !== null };
}

/** WhatsApp's warning signals on an event (capping, reach-out time lock), or null. */
export function warningOf(envelope: EnvelopeLike): string | null {
  const me = record(envelope.me);
  const data = record(record(envelope.payload)['data']);
  // The manual day showed the capping block on every event's `me` and, on `WORKING`, also in
  // `session.status` `payload.data`.
  for (const capping of [
    record(me['messageCapping'])['cappingStatus'],
    record(data['messageCapping'])['cappingStatus'],
  ]) {
    if (typeof capping === 'string' && capping !== 'NONE') {
      return `capping_${capping.toLowerCase()}`;
    }
  }
  if (
    record(me['reachoutTimelock'])['isActive'] === true ||
    record(data['reachoutTimelock'])['isActive'] === true
  ) {
    return 'reachout_timelock';
  }
  return null;
}

const INBOUND = new Set(['message', 'message.edited', 'message.revoked', 'message.reaction']);
const ACK_NAMES: Record<number, string> = {
  [-1]: 'ERROR',
  0: 'PENDING',
  1: 'SERVER',
  2: 'DEVICE',
  3: 'READ',
  4: 'PLAYED',
};

/** The facts the service acts on, with no values that differ between two runs. */
export function normaliseEvent(envelope: EnvelopeLike): Record<string, unknown> {
  const event = typeof envelope.event === 'string' ? envelope.event : '';
  const out: Record<string, unknown> = {
    event,
    session: typeof envelope.session === 'string' && envelope.session !== '',
    eventId: typeof envelope.id === 'string' && envelope.id.startsWith('evt_'),
    timestampMs: typeof envelope.timestamp === 'number' && envelope.timestamp > 1e12,
    me: envelope.me === null ? 'null' : typeof envelope.me,
    meIdKind: chatKind(record(envelope.me)['id']),
    warning: warningOf(envelope),
  };
  const p = record(envelope.payload);
  if (INBOUND.has(event)) {
    const parts = inboundParts(event, envelope);
    out['chat'] = chatKind(parts.from);
    out['fromMe'] = parts.fromMe;
    out['messageId'] = parts.idOk;
    out['timestampSeconds'] = parts.timestamp > 1e9 && parts.timestamp < 1e11;
    out['text'] = parts.text !== null;
  } else if (event === 'message.ack') {
    const id = typeof p['id'] === 'string' ? p['id'] : '';
    out['ackChat'] = chatKind(MESSAGE_ID.exec(id)?.[2]);
    out['ackFrom'] = chatKind(p['from']);
    out['fromMe'] = p['fromMe'] === true;
    out['messageKey'] = messageKeyOf(id) !== null;
    out['ack'] = p['ack'];
    out['ackName'] = typeof p['ack'] === 'number' && ACK_NAMES[p['ack']] === p['ackName'];
    out['ackError'] = typeof record(p['_data'])['error'] === 'string';
  } else if (event === 'session.status') {
    out['status'] = p['status'];
    out['statusName'] = typeof p['name'] === 'string' && p['name'] === envelope.session;
    out['statuses'] = Array.isArray(p['statuses']);
  }
  return out;
}
