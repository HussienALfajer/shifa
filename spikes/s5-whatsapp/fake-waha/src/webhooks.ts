// Webhook delivery as WAHA does it: POST of the JSON body with X-Webhook-Request-Id,
// X-Webhook-Timestamp and, with an HMAC key, X-Webhook-Hmac (HMAC-SHA512 of the raw body, hex)
// and X-Webhook-Hmac-Algorithm: sha512. Faults: hold and release in any order, duplicate the
// next delivery, replay any past event, sign with another key or none.
import { createHmac, randomBytes } from 'node:crypto';
import type { Envelope } from './events.ts';

export interface DeliveryOptions {
  /** Sign with this key instead of the container's; `null` sends no signature. */
  hmacKey?: string | null;
  /** Post to this URL instead of the container's webhook URL. */
  url?: string;
}

export interface Delivery {
  /** HTTP status the service answered (0 when it could not be reached). */
  status: number;
  eventId: string;
  /** Payload id of a message event (empty for other events). */
  messageId: string;
}

interface Pending {
  raw: string;
  envelope: Envelope;
  options: DeliveryOptions;
  resolve: (d: Delivery) => void;
}

export class WebhookEmitter {
  private held: Pending[] | null = null;
  private duplicate = false;
  private readonly history = new Map<string, { raw: string; envelope: Envelope }>();

  constructor(
    public url: string,
    private readonly hmacKey: string,
    private readonly log: (line: string) => void,
  ) {}

  deliver(envelope: Envelope, options: DeliveryOptions = {}): Promise<Delivery> {
    const raw = JSON.stringify(envelope);
    this.history.set(envelope.id, { raw, envelope });
    if (this.held) {
      const held = this.held;
      return new Promise((resolve) => held.push({ raw, envelope, options, resolve }));
    }
    return this.post(raw, envelope, options);
  }

  replay(eventId: string): Promise<Delivery> {
    const past = this.history.get(eventId);
    if (!past) throw new Error('unknown event');
    return this.post(past.raw, past.envelope, {});
  }

  hold(): void {
    this.held ??= [];
  }

  async release(reverse: boolean): Promise<void> {
    const held = this.held ?? [];
    this.held = null;
    for (const p of reverse ? held.reverse() : held) {
      p.resolve(await this.post(p.raw, p.envelope, p.options));
    }
  }

  duplicateNext(): void {
    this.duplicate = true;
  }

  private async post(raw: string, envelope: Envelope, options: DeliveryOptions): Promise<Delivery> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-webhook-request-id': `req_${randomBytes(12).toString('hex')}`,
      'x-webhook-timestamp': String(Date.now()),
    };
    const key = options.hmacKey === undefined ? this.hmacKey : options.hmacKey;
    if (key !== null) {
      headers['x-webhook-hmac'] = createHmac('sha512', key).update(raw).digest('hex');
      headers['x-webhook-hmac-algorithm'] = 'sha512';
    }
    const times = this.duplicate ? 2 : 1;
    this.duplicate = false;
    let status = 0;
    for (let i = 0; i < times; i++) {
      const res = await fetch(options.url ?? this.url, {
        method: 'POST',
        headers,
        body: raw,
      }).catch(() => null);
      if (i === 0) status = res?.status ?? 0;
      await res?.body?.cancel();
    }
    this.log(JSON.stringify({ event: 'fake_webhook', type: envelope.event, status }));
    const payloadId = envelope.payload['id'];
    return {
      status,
      eventId: envelope.id,
      messageId: typeof payloadId === 'string' ? payloadId : '',
    };
  }
}
