// Regression tests for the 0.3-S7a review: the dead record names the token that was sent, a bare
// 404 does not kill a device, and a refused key is logged as `auth`, not retried as `network`.
import { join } from 'node:path';
import { hashToken } from '@shifa-spike/s7-receiver';
import { afterEach, describe, expect, it } from 'vitest';
import { createSender } from '../src/send.ts';
import { type FakeFcm, startFakeFcm, unregistered } from './fakes/fcm.ts';
import { receiverWithDevices, tempDir } from './helpers.ts';

const REQUEST = {
  kind: 'reminder' as const,
  appointmentId: 'appt-1',
  appointmentAt: new Date(Date.now() + 3600_000),
  to: 'install-1',
};

let fcm: FakeFcm | undefined;
let cleanup: (() => void) | undefined;
afterEach(async () => {
  await fcm?.close();
  fcm = undefined;
  cleanup?.();
});

async function setup(getToken: () => Promise<string> = () => Promise.resolve('fake-access')) {
  const t = tempDir();
  cleanup = t.cleanup;
  const receiver = await receiverWithDevices(t.dir, ['install-1']);
  fcm = await startFakeFcm();
  const delays: number[] = [];
  const sender = createSender({
    receiver,
    fcmBaseUrl: fcm.url,
    projectId: 's7-fake',
    getToken,
    logDir: join(t.dir, 'logs'),
    sleep: (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
  });
  return { receiver, sender, delays, fake: fcm };
}

describe('review fixes', () => {
  it('a token reported during a failing send keeps the device alive', async () => {
    const s = await setup();
    s.fake.enqueue(404, unregistered);
    // The probe reports a fresh token while the send with the old one is in flight.
    const original = s.receiver.devices.bind(s.receiver);
    s.receiver.devices = async () => {
      // The sender resolves its target with the old token; the new report lands right after.
      const resolved = await original();
      await s.receiver.reportDevice({
        installId: 'install-1',
        tokenHash: 'new',
        token: 'token-install-1-rotated',
        permission: 'granted',
        channels: { appointments: 'high', general: 'default' },
        appVersion: '0.0.1',
        sdkInt: 34,
        model: 'sdk_gphone64_x86_64',
      });
      return resolved;
    };
    await s.sender.send(REQUEST);
    const dead = await s.receiver.store.readAll<{ tokenHash: string }>('dead');
    expect(dead.map((d) => d.tokenHash)).toEqual([hashToken('token-install-1')]);
    expect(await s.receiver.isDead('install-1')).toBe(false);
  });

  it('a 404 without UNREGISTERED does not mark the device dead', async () => {
    const s = await setup();
    s.fake.enqueue(404, { error: { code: 404, status: 'NOT_FOUND' } });
    const [line] = await s.sender.send(REQUEST);
    expect(line).toMatchObject({ httpStatus: 404, error: 'NOT_FOUND', attempts: 1 });
    expect(await s.receiver.isDead('install-1')).toBe(false);
  });

  it('a refused key is logged as auth and not retried', async () => {
    const s = await setup(() => Promise.reject(new Error('token endpoint returned 400')));
    const [line] = await s.sender.send(REQUEST);
    expect(line).toMatchObject({ httpStatus: null, error: 'auth', attempts: 1 });
    expect(s.delays).toEqual([]);
    expect(s.fake.requests).toHaveLength(0);
  });
});
