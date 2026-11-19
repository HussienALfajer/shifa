// Regression test for the 0.3-S7a security review: no browser page and no rebound DNS name can
// write to or read from the receiver.
import { request } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { type ReceiverServer } from '../src/index.ts';
import { postJson, started, tempDir } from './helpers.ts';

let server: ReceiverServer | undefined;
let cleanup: (() => void) | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
  cleanup?.();
});

/** Raw request, so the test controls Host and Origin (fetch forbids setting them). */
function raw(
  port: number,
  opts: { method: string; path: string; headers: Record<string, string>; body?: string },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, method: opts.method, path: opts.path, headers: opts.headers },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', reject);
    req.end(opts.body);
  });
}

describe('request guard', () => {
  it('refuses browser origins, unknown hosts and non-JSON writes; the probe path still works', async () => {
    const t = tempDir();
    cleanup = t.cleanup;
    server = await started(t.dir);
    const host = `127.0.0.1:${String(server.port)}`;
    const body = JSON.stringify({ installId: 'victim' });

    expect(
      await raw(server.port, {
        method: 'POST',
        path: '/devices',
        headers: { host, origin: 'https://evil.example', 'content-type': 'text/plain' },
        body,
      }),
    ).toBe(403);
    expect(
      await raw(server.port, {
        method: 'GET',
        path: '/inbox?installId=victim',
        headers: { host: `rebound.example:${String(server.port)}` },
      }),
    ).toBe(403);
    expect(
      await raw(server.port, {
        method: 'POST',
        path: '/receipts',
        headers: { host, 'content-type': 'text/plain' },
        body,
      }),
    ).toBe(415);
    // The emulator's address is accepted.
    expect(
      await raw(server.port, {
        method: 'GET',
        path: '/time',
        headers: { host: `10.0.2.2:${String(server.port)}` },
      }),
    ).toBe(200);
    expect((await postJson(`${server.url}/devices`, { installId: 'x' })).status).toBe(400);
  });
});
