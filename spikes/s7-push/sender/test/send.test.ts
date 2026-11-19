// Criteria 2 and 3: inbox record before the FCM call, send log, dead tokens, retries.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Receiver } from '@shifa-spike/s7-receiver';
import { afterEach, describe, expect, it } from 'vitest';
import { createSender, type SendLogLine } from '../src/send.ts';
import { type FakeFcm, invalidArgument, startFakeFcm, unregistered } from './fakes/fcm.ts';
import { receiverWithDevices, tempDir } from './helpers.ts';

const APPOINTMENT = {
  kind: 'reminder' as const,
  appointmentId: 'appt-1',
  appointmentAt: new Date(Date.now() + 2 * 3600_000),
};

let fcm: FakeFcm | undefined;
let cleanup: (() => void) | undefined;
afterEach(async () => {
  await fcm?.close();
  fcm = undefined;
  cleanup?.();
});

async function setup(installIds: string[], onRequest?: Parameters<typeof startFakeFcm>[0]) {
  const t = tempDir();
  cleanup = t.cleanup;
  const receiver = await receiverWithDevices(t.dir, installIds);
  fcm = await startFakeFcm(onRequest);
  const delays: number[] = [];
  let id = 0;
  const sender = createSender({
    receiver,
    fcmBaseUrl: fcm.url,
    projectId: 's7-fake',
    getToken: () => Promise.resolve('fake-access'),
    logDir: join(t.dir, 'logs'),
    sleep: (ms) => {
      delays.push(ms);
      return Promise.resolve();
    },
    newId: () => `s7-${String(++id).padStart(4, '0')}`,
  });
  const sendLog = () =>
    readFileSync(join(t.dir, 'logs', 'sends.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as SendLogLine);
  return { receiver, sender, delays, sendLog, fake: fcm };
}

describe('send', () => {
  it('writes the inbox record before the FCM request arrives and logs the response', async () => {
    let receiverRef: Receiver | undefined;
    const seenAtArrival: boolean[] = [];
    const s = await setup(['install-1'], {
      onRequest: async (req) => {
        const s7id = req.body.message.data?.s7id;
        const inbox = (await receiverRef?.inbox('install-1')) ?? [];
        seenAtArrival.push(inbox.some((r) => r.s7id === s7id));
      },
    });
    receiverRef = s.receiver;

    const lines = await s.sender.send({ ...APPOINTMENT, to: 'install-1' });
    expect(seenAtArrival).toEqual([true]);
    expect(s.fake.requests).toHaveLength(1);
    const req = s.fake.requests[0];
    expect(req?.path).toBe('/v1/projects/s7-fake/messages:send');
    expect(req?.authorization).toBe('Bearer fake-access');
    expect(req?.body.message.token).toBe('token-install-1');

    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line).toMatchObject({
      s7id: 's7-0001',
      installId: 'install-1',
      label: 's7_reminder',
      httpStatus: 200,
      attempts: 1,
    });
    expect(line?.fcmName).toMatch(/^projects\/s7-fake\/messages\//);
    expect(line?.sentAt).toBeTypeOf('string');
    expect(line?.durationMs).toBeGreaterThanOrEqual(0);
    expect(s.sendLog()).toEqual(lines);
    // The send log never holds the device token.
    expect(JSON.stringify(s.sendLog())).not.toContain('token-install-1');

    const inbox = await s.receiver.inbox('install-1');
    expect(inbox).toEqual([
      expect.objectContaining({ s7id: 's7-0001', appointmentId: 'appt-1', kind: 'reminder' }),
    ]);
  });

  it('--count sends separate messages to every live device', async () => {
    const s = await setup(['install-1', 'install-2']);
    const lines = await s.sender.send({ ...APPOINTMENT, to: 'all', count: 2 });
    expect(lines.map((l) => [l.installId, l.s7id])).toEqual([
      ['install-1', 's7-0001'],
      ['install-1', 's7-0002'],
      ['install-2', 's7-0003'],
      ['install-2', 's7-0004'],
    ]);
    expect(s.fake.requests).toHaveLength(4);
  });

  it('UNREGISTERED marks the device dead; the next send skips it and a direct send is refused', async () => {
    const s = await setup(['install-1']);
    s.fake.enqueue(404, unregistered);
    const [line] = await s.sender.send({ ...APPOINTMENT, to: 'install-1' });
    expect(line).toMatchObject({ httpStatus: 404, error: 'UNREGISTERED', attempts: 1 });
    expect(await s.receiver.isDead('install-1')).toBe(true);

    expect(await s.sender.send({ ...APPOINTMENT, to: 'all' })).toEqual([]);
    await expect(s.sender.send({ ...APPOINTMENT, to: 'install-1' })).rejects.toThrow(/dead/);
    expect(s.fake.requests).toHaveLength(1);
  });

  it('INVALID_ARGUMENT on the token marks the device dead', async () => {
    const s = await setup(['install-1']);
    s.fake.enqueue(400, invalidArgument('message.token'));
    const [line] = await s.sender.send({ ...APPOINTMENT, to: 'install-1' });
    expect(line).toMatchObject({ httpStatus: 400, error: 'INVALID_ARGUMENT' });
    expect(await s.receiver.isDead('install-1')).toBe(true);
  });

  it('429 then 200 retries with backoff and the same s7id', async () => {
    const s = await setup(['install-1']);
    s.fake.enqueue(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED' } });
    const [line] = await s.sender.send({ ...APPOINTMENT, to: 'install-1' });
    expect(s.fake.requests.map((r) => r.body.message.data?.s7id)).toEqual(['s7-0001', 's7-0001']);
    expect(line).toMatchObject({ s7id: 's7-0001', httpStatus: 200, attempts: 2 });
    expect(s.delays).toHaveLength(1);
    expect(s.delays[0]).toBeGreaterThan(0);
    // One inbox record per s7id, not one per attempt.
    expect(await s.receiver.inbox('install-1')).toHaveLength(1);
  });

  it('5xx is retried at most 3 times, with growing delays', async () => {
    const s = await setup(['install-1']);
    for (let i = 0; i < 5; i += 1) s.fake.enqueue(503, { error: { code: 503 } });
    const [line] = await s.sender.send({ ...APPOINTMENT, to: 'install-1' });
    expect(s.fake.requests).toHaveLength(4);
    expect(line).toMatchObject({ httpStatus: 503, attempts: 4 });
    expect(s.delays).toHaveLength(3);
    expect(s.delays[1]).toBeGreaterThan(s.delays[0] ?? 0);
    expect(await s.receiver.isDead('install-1')).toBe(false);
  });

  it('400 on the label is not retried and does not kill the device', async () => {
    const s = await setup(['install-1']);
    s.fake.enqueue(400, invalidArgument('message.fcm_options.analytics_label'));
    const [line] = await s.sender.send({ ...APPOINTMENT, to: 'install-1' });
    expect(s.fake.requests).toHaveLength(1);
    expect(line).toMatchObject({ httpStatus: 400, error: 'INVALID_ARGUMENT', attempts: 1 });
    expect(await s.receiver.isDead('install-1')).toBe(false);
  });

  it('refuses an unknown device', async () => {
    const s = await setup(['install-1']);
    await expect(s.sender.send({ ...APPOINTMENT, to: 'install-9' })).rejects.toThrow(/unknown/);
    expect(s.fake.requests).toHaveLength(0);
  });
});
