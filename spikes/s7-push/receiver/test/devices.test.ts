// Criterion 1 / PAT-21: the probe's state report is stored; the full token never reaches a log.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type ReceiverServer } from '../src/index.ts';
import { postJson, started, tempDir } from './helpers.ts';

// Built at run time so no token-shaped string sits in the repository (key-leak check).
const TOKEN = `fakeInstance123456789:${'APA91b'}${'x'.repeat(140)}`;

const report = (permission: string, appointments: string) => ({
  installId: 'install-1',
  tokenHash: 'ab12cd34',
  token: TOKEN,
  permission,
  channels: { appointments, general: 'default' },
  appVersion: '0.0.1',
  sdkInt: 34,
  model: 'sdk_gphone64_x86_64',
});

let server: ReceiverServer | undefined;
let cleanup: (() => void) | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
  cleanup?.();
});

describe('device state reports', () => {
  it('stores permission and channel importance; a later report replaces it; no token in logs', async () => {
    const t = tempDir();
    cleanup = t.cleanup;
    server = await started(t.dir);

    expect((await postJson(`${server.url}/devices`, report('granted', 'high'))).status).toBe(204);
    let devices = await server.receiver.devices();
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      installId: 'install-1',
      permission: 'granted',
      channels: { appointments: 'high', general: 'default' },
      token: TOKEN,
    });
    expect(devices[0]?.reportedAt).toBeTypeOf('string');

    expect((await postJson(`${server.url}/devices`, report('denied', 'none'))).status).toBe(204);
    devices = await server.receiver.devices();
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ permission: 'denied', channels: { appointments: 'none' } });

    // A malformed report is refused and not stored.
    expect((await postJson(`${server.url}/devices`, { installId: 'x' })).status).toBe(400);
    expect(await server.receiver.devices()).toHaveLength(1);

    // Every log file (requests, receipts, inbox) is free of the full token.
    const logs = join(t.dir, 'logs');
    const files = readdirSync(logs);
    expect(files).toContain('requests.jsonl');
    for (const f of files) expect(readFileSync(join(logs, f), 'utf8')).not.toContain(TOKEN);
    expect(readFileSync(join(logs, 'requests.jsonl'), 'utf8')).toContain('/devices');
  });

  it('stores receipts posted by the probe', async () => {
    const t = tempDir();
    cleanup = t.cleanup;
    server = await started(t.dir);
    const receipt = {
      installId: 'install-1',
      s7id: 's7-1',
      fcmMessageId: '0:123',
      label: 's7_reminder',
      sentAt: '2026-11-19T08:00:00.000Z',
      receivedAt: '2026-11-19T08:00:02.000Z',
      clockOffsetMs: -40,
      appState: 'background',
      path: 'background',
    };
    expect((await postJson(`${server.url}/receipts`, receipt)).status).toBe(204);
    expect((await postJson(`${server.url}/receipts`, { s7id: 1 })).status).toBe(400);
    expect(await server.receiver.receipts()).toEqual([expect.objectContaining(receipt)]);
  });

  it('marks a device dead and remembers it', async () => {
    const t = tempDir();
    cleanup = t.cleanup;
    server = await started(t.dir);
    expect(await server.receiver.isDead('install-1')).toBe(false);
    await server.receiver.markDead('install-1', 'UNREGISTERED');
    expect(await server.receiver.isDead('install-1')).toBe(true);
    // A fresh report from a reinstalled app (new token) revives it.
    await postJson(`${server.url}/devices`, { ...report('granted', 'high'), token: `${TOKEN}y` });
    expect(await server.receiver.isDead('install-1')).toBe(false);
  });
});
