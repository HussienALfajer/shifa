// Review of 0.3-S5a (B1, MSG-10): with a single worker process, a session waiting out its gap
// does not hold up another session: B's message goes out inside A's gap.
import { randomBytes } from 'node:crypto';
import { createRandom, generatePhone } from '@shifa/testing';
import { type FakeWaha, startFakeWaha } from '@shifa-spike/s5-fake-waha';
import { afterAll, describe, expect, it } from 'vitest';
import { createMessaging, type Messaging, type MessagingConfig } from '../src/index.ts';
import { spawnWorker, type WorkerProcess } from '../src/spawn.ts';
import { INSTANT_PACING, PLATFORM_NUMBER, useDatabase } from './harness.ts';

const pg = useDatabase();
const secret = () => randomBytes(18).toString('base64url');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const opened: { fake?: FakeWaha; worker?: WorkerProcess; producer?: Messaging } = {};
afterAll(async () => {
  await opened.worker?.stop();
  await opened.producer?.close();
  await opened.fake?.close();
});

describe('one worker, two sessions', () => {
  it("sends B's message while A waits for its gap", async () => {
    const key = { apiKey: secret(), hmacKey: secret() };
    const fake = await startFakeWaha({
      container: 'clinics',
      ...key,
      webhookUrl: 'http://127.0.0.1:9/x',
    });
    opened.fake = fake;
    const config: MessagingConfig = {
      databaseUrl: await pg.db.createDatabase(`parallel_${String(process.pid)}`),
      containers: { clinics: { wahaUrl: fake.url, ...key } },
      sessions: [
        {
          name: 'clinic-a',
          container: 'clinics',
          clinicId: 'c-a',
          role: 'clinic',
          timeZone: 'Asia/Damascus',
        },
        {
          name: 'clinic-b',
          container: 'clinics',
          clinicId: 'c-b',
          role: 'clinic',
          timeZone: 'Asia/Damascus',
        },
      ],
      allowlist: new Set<string>(),
      pacing: { ...INSTANT_PACING, minGapMs: 4_000, maxGapMs: 4_000, inlineWaitMaxMs: 10_000 },
      sendTimeoutMs: 3_000,
      adminToken: secret(),
      verify: { platformNumber: PLATFORM_NUMBER, serverKey: secret() },
      queue: 'producer',
    };
    const random = createRandom(9);
    const producer = await createMessaging(config);
    opened.producer = producer;
    fake.setWebhookUrl(`${await producer.listen()}/webhooks/clinics`);
    const patients = { a: generatePhone(random, 'SY'), b: generatePhone(random, 'SY') };
    for (const [clinic, session, phone] of [
      ['c-a', 'clinic-a', patients.a],
      ['c-b', 'clinic-b', patients.b],
    ] as const) {
      config.allowlist.add(phone);
      await fake.addWorkingSession(session);
      await producer.registerPatient(clinic, 'p1', phone);
      await fake.inbound(session, { from: `${phone.slice(1)}@c.us`, body: 'مرحبا' });
    }
    const send = (clinic: string) =>
      producer.sendWhatsApp(clinic, 'p1', 'appointment_reminder', {
        name: 'س',
        date: 'd',
        time: 't',
      });

    opened.worker = spawnWorker({ ...config, queue: 'worker' });
    await opened.worker.ready;
    await send('c-a');
    await send('c-a');
    await fake.waitForCall('/api/sendText', 30_000);
    await send('c-b');

    const texts = () => fake.calls.filter((c) => c.path === '/api/sendText');
    const deadline = Date.now() + 40_000;
    while (texts().length < 3) {
      if (Date.now() > deadline) throw new Error(`only ${String(texts().length)} sends`);
      await sleep(100);
    }
    const [a1, a2] = texts().filter((c) => c.session === 'clinic-a');
    const [b1] = texts().filter((c) => c.session === 'clinic-b');
    expect((a2?.at ?? 0) - (a1?.at ?? 0)).toBeGreaterThanOrEqual(3_900);
    expect(b1?.at ?? Infinity).toBeLessThan(a2?.at ?? 0);
  });
});
