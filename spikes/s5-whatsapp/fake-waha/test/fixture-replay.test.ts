// Criteria 1 and 2 (0.3-S5c): the fake tells the truth. Every webhook body captured on the owner's
// manual day (scrubbed, committed in `spikes/s5-whatsapp/fixtures/`) goes through the service's
// own webhook parsers (`messaging/src/normalise.ts`, the code `webhook.ts` routes with), and so
// does the fake's event of the same kind built from the same facts (chat, direction, ack level,
// session status). Both must normalise to the same event, and the fake's body must have the same
// fields as the real one; every difference fails and is listed by field name. Each fixture also
// keeps the signature check recomputed in the real run, which must be "valid" (criterion 1).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normaliseEvent } from '../../messaging/src/normalise.ts';
import {
  ackPayload,
  type EventName,
  envelope,
  inboundPayload,
  type Me,
  meOf,
  type SessionStatus,
  statusPayload,
} from '../src/events.ts';

const DIR = join(import.meta.dirname, '..', '..', 'fixtures');

interface Fixture {
  file: string;
  container: string;
  signature: { present: boolean; valid: boolean; algorithm: string };
  body: Record<string, unknown> & {
    event: EventName;
    session: string;
    timestamp: number;
    me: Record<string, unknown> | null;
    payload: Record<string, unknown>;
  };
}

const fixtures: Fixture[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((file) => ({ file, ...(JSON.parse(readFileSync(join(DIR, file), 'utf8')) as object) }))
  .map((f) => f as Fixture);

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const KEY = 'ABCDEF0123456789ABCD';

/** The fake's event with the same facts as a real one. */
function fakeTwin(real: Fixture['body']): Record<string, unknown> {
  const p = real.payload;
  const me: Me | null =
    real.me === null ? null : meOf('963990000001@c.us', '963990000002@lid', 'clinic');
  const at = real.timestamp;
  const seconds = Math.floor(at / 1000);
  let payload: Record<string, unknown>;
  switch (real.event) {
    case 'message':
    case 'message.reaction':
    case 'message.revoked': {
      const src = (real.event === 'message.revoked' ? p['after'] : p) as Record<string, unknown>;
      const kind =
        real.event === 'message'
          ? 'message'
          : real.event === 'message.reaction'
            ? 'reaction'
            : 'revoked';
      payload = inboundPayload(
        {
          from: str(src['from']) ?? '',
          kind,
          fromMe: src['fromMe'] === true,
          ...(str(src['participant']) ? { participant: str(src['participant']) } : {}),
          ...(typeof src['body'] === 'string' ? { body: 'text' } : {}),
          ...(src['hasMedia'] === true ? { hasMedia: true } : {}),
        },
        me?.id ?? '',
        seconds,
      ).payload;
      break;
    }
    case 'message.ack': {
      // Our own send: WAHA returned `true_<phone>@c.us_<key>`; the ack names the chat as it does.
      // A message someone sent to us and we read (`fromMe: false`) keeps its own id (owner
      // approved this correction of the locked test, 2026-11-19).
      const incoming = p['fromMe'] === false;
      const sent = incoming
        ? `false_${str(p['from']) ?? ''}_${KEY}`
        : `true_963930012345@c.us_${KEY}`;
      payload = ackPayload(
        sent,
        Number(p['ack']),
        undefined,
        incoming ? undefined : str(p['from']),
      );
      break;
    }
    case 'session.status': {
      const status = str(p['status']) as SessionStatus;
      const data = p['data'] as Record<string, unknown> | null;
      payload = statusPayload(real.session, status, [], {
        capping: Boolean(data && 'messageCapping' in data),
        loggedOut: Boolean(data && 'reason' in data),
      });
      break;
    }
    case 'message.edited':
      // No edit was captured on the manual day: nothing to compare.
      payload = {};
  }
  const env = envelope(real.event, real.session, me, payload, at);
  return env as unknown as Record<string, unknown>;
}

const typeOf = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** Field differences between a real body and the fake's: missing, extra, or of another type. */
function shapeDiff(real: unknown, fake: unknown, path = ''): string[] {
  if (typeOf(real) !== 'object' || typeOf(fake) !== 'object') {
    // The scrubber writes null for dropped values (`_data`, `vCards`, media): no type to compare.
    if (real === null || fake === null || typeOf(real) === typeOf(fake)) return [];
    return [`${path}: real ${typeOf(real)}, fake ${typeOf(fake)}`];
  }
  const r = real as Record<string, unknown>;
  const f = fake as Record<string, unknown>;
  const out: string[] = [];
  for (const k of Object.keys(r)) {
    if (!(k in f)) out.push(`${path}${k}: missing in the fake`);
  }
  for (const k of Object.keys(f)) {
    if (!(k in r)) out.push(`${path}${k}: only in the fake`);
  }
  // Values the fake fills itself (capping quota, environment) are compared by field set only.
  const deep =
    path.split('.').length <= 2 && !['environment.', 'me.messageCapping.'].includes(path);
  if (deep) {
    for (const k of Object.keys(r)) {
      if (k in f) out.push(...shapeDiff(r[k], f[k], `${path}${k}.`));
    }
  }
  return out;
}

function normalisedDiff(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys]
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => `${k}: real ${JSON.stringify(a[k])}, fake ${JSON.stringify(b[k])}`);
}

describe('fixture replay: real WAHA events against the fake', () => {
  it('has fixtures of every event kind the service routes', () => {
    const kinds = new Set(fixtures.map((f) => f.body.event));
    for (const kind of ['message', 'message.ack', 'session.status'] as const) {
      expect(kinds.has(kind), kind).toBe(true);
    }
  });

  it('every fixture was signed and its signature checked valid in the real run', () => {
    const bad = fixtures
      .filter(
        (f) => !f.signature.present || !f.signature.valid || f.signature.algorithm !== 'sha512',
      )
      .map((f) => f.file);
    expect(bad).toEqual([]);
  });

  it("each real event and the fake's twin normalise to the same event", () => {
    const problems: string[] = [];
    for (const f of fixtures) {
      const real = normaliseEvent(f.body);
      const fake = normaliseEvent(fakeTwin(f.body));
      for (const d of normalisedDiff(real, fake)) problems.push(`${f.file} ${d}`);
    }
    expect(problems).toEqual([]);
  });

  it("the fake's bodies have the real fields", () => {
    const problems = new Set<string>();
    for (const f of fixtures) {
      for (const d of shapeDiff(f.body, fakeTwin(f.body))) problems.add(`${f.body.event} ${d}`);
    }
    expect([...problems].sort()).toEqual([]);
  });

  it('acks of our sends name the LID chat but keep the key of the send (manual day finding)', () => {
    const acks = fixtures.filter((f) => f.body.event === 'message.ack' && f.body.payload['fromMe']);
    expect(acks.length).toBeGreaterThan(0);
    const real = normaliseEvent(acks[0]?.body ?? {});
    expect(real['ackChat']).toBe('lid');
    const fake = ackPayload(`true_963930012345@c.us_${KEY}`, 3, undefined, '963930080001@lid');
    expect(fake.id).toBe(`true_963930080001@lid_${KEY}`);
  });
});
