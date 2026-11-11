// Spec edge case "GlitchTip down": reporting never throws into the API, and delivery failures
// become one throttled warning, never one per event.
import { createServer } from 'node:net';
import { createEnvelope } from '@sentry/core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  fetchTransport,
  flushErrors,
  reportError,
  startErrorReporting,
  stopErrorReporting,
} from '../../src/telemetry/errors.ts';

/** A port that was free a moment ago: nothing listens there. */
async function closedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('no port'));
      });
    });
  });
}

afterEach(async () => {
  await stopErrorReporting();
});

describe('error delivery with GlitchTip down', () => {
  it('the transport warns once for many failed sends', async () => {
    let warnings = 0;
    const port = await closedPort();
    const transport = fetchTransport(
      {
        url: `http://127.0.0.1:${String(port)}/api/1/envelope/`,
        recordDroppedEvent: () => undefined,
      },
      () => {
        warnings += 1;
      },
    );
    for (let i = 0; i < 5; i += 1) {
      const envelope = createEnvelope({}, [[{ type: 'event' }, { event_id: String(i) }]]);
      await Promise.resolve(transport.send(envelope)).catch(() => undefined);
    }
    expect(warnings).toBe(1);
  });

  it('reportError neither throws nor hangs; one warning for many events', async () => {
    let warnings = 0;
    const port = await closedPort();
    startErrorReporting({
      dsn: `http://public@127.0.0.1:${String(port)}/1`,
      release: 'shifa-api@0.0.0-test',
      environment: 'test',
      onSendFailure: () => {
        warnings += 1;
      },
    });
    for (let i = 0; i < 5; i += 1) {
      expect(() => {
        reportError(new Error('x'), { type: 'Error', status: 500 });
      }).not.toThrow();
    }
    await flushErrors(5000);
    expect(warnings).toBe(1);
  });
});
