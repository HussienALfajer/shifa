// A stub Sentry transport for tests: records every envelope exactly as it would go over the wire
// (the serialised body), and parses the error events out of them.
import { type BaseTransportOptions, createTransport, type Transport } from '@sentry/core';

/** A DSN that is never contacted: the stub transport replaces the network. */
export const TEST_DSN = 'http://public@127.0.0.1:9/1';

export interface EnvelopeItem {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export interface ErrorSink {
  transport: (options: BaseTransportOptions) => Transport;
  /** Every envelope body sent so far, serialised. */
  text(): string;
  /** The payloads of the `event` items sent so far. */
  events(): Record<string, unknown>[];
  reset(): void;
}

function itemsOf(body: string): EnvelopeItem[] {
  const [, ...lines] = body.split('\n').filter((line) => line.trim() !== '');
  const items: EnvelopeItem[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    items.push({
      header: JSON.parse(lines[i] ?? '{}') as Record<string, unknown>,
      payload: JSON.parse(lines[i + 1] ?? '{}') as Record<string, unknown>,
    });
  }
  return items;
}

export function errorSink(): ErrorSink {
  const bodies: string[] = [];
  return {
    transport: (options) =>
      createTransport(options, (request) => {
        bodies.push(
          typeof request.body === 'string' ? request.body : new TextDecoder().decode(request.body),
        );
        return Promise.resolve({ statusCode: 200 });
      }),
    text: () => bodies.join('\n'),
    events: () =>
      bodies
        .flatMap(itemsOf)
        .filter((item) => item.header['type'] === 'event')
        .map((item) => item.payload),
    reset: () => {
      bodies.length = 0;
    },
  };
}
