// Criterion 5 (MSG-10, MSG-15): the pacing rules hold through real pg-boss with two worker
// processes, on a compressed config (gap 200–600 ms, cap 6 per rolling 6 s, a 2 s quiet
// window): one send at a time per session, FIFO order, seen → typing → send, typing longer for
// longer text; two sessions in two containers progress in parallel.
import { randomBytes } from 'node:crypto';
import { createRandom, generatePhone } from '@shifa/testing';
import { type FakeCall, type FakeWaha, startFakeWaha } from '@shifa-spike/s5-fake-waha';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createMessaging,
  type Messaging,
  type MessagingConfig,
  type PacingConfig,
  type SessionConfig,
} from '../src/index.ts';
import { spawnWorker, type WorkerProcess } from '../src/spawn.ts';
import { PLATFORM_NUMBER, useDatabase } from './harness.ts';

const pg = useDatabase();
const secret = () => randomBytes(18).toString('base64url');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const PACED = ['/api/sendSeen', '/api/startTyping', '/api/stopTyping', '/api/sendText'];

const opened: { fakes: FakeWaha[]; workers: WorkerProcess[]; producer?: Messaging } = {
  fakes: [],
  workers: [],
};
afterAll(async () => {
  for (const w of opened.workers) await w.stop();
  await opened.producer?.close();
  for (const f of opened.fakes) await f.close();
});

describe('per-session queue through pg-boss', () => {
  it('keeps every rule with two worker processes and two containers', async () => {
    const start = Date.now();
    const quiet = { from: start + 4_000, to: start + 6_000 };
    const pacing: PacingConfig = {
      minGapMs: 200,
      maxGapMs: 600,
      capPerWindow: 6,
      windowMs: 6_000,
      quiet: { kind: 'window', ...quiet },
      deferSpreadMs: 300,
      typing: { perCharMs: 2, minMs: 50, maxMs: 400 },
      inlineWaitMaxMs: 7_000,
    };
    const sessions: SessionConfig[] = [
      {
        name: 'clinic-a',
        container: 'clinics-1',
        clinicId: 'c-a',
        role: 'clinic',
        timeZone: 'Asia/Damascus',
      },
      {
        name: 'clinic-b',
        container: 'clinics-2',
        clinicId: 'c-b',
        role: 'clinic',
        timeZone: 'Asia/Damascus',
      },
    ];
    const keys = {
      'clinics-1': { apiKey: secret(), hmacKey: secret() },
      'clinics-2': { apiKey: secret(), hmacKey: secret() },
    };
    const fakes: Record<string, FakeWaha> = {};
    for (const [container, key] of Object.entries(keys)) {
      const fake = await startFakeWaha({
        container,
        ...key,
        webhookUrl: 'http://127.0.0.1:9/pending',
      });
      opened.fakes.push(fake);
      fakes[container] = fake;
    }
    const config: MessagingConfig = {
      databaseUrl: await pg.db.createDatabase(`queue_${String(process.pid)}`),
      containers: Object.fromEntries(
        Object.entries(keys).map(([c, k]) => [c, { wahaUrl: fakes[c]?.url ?? '', ...k }]),
      ),
      sessions,
      allowlist: new Set<string>(),
      pacing,
      sendTimeoutMs: 3_000,
      adminToken: secret(),
      verify: { platformNumber: PLATFORM_NUMBER, serverKey: secret() },
      queue: 'producer',
    };
    const random = createRandom(5);
    const patients = Array.from({ length: 4 }, (_, i) => ({
      clinicId: i < 2 ? 'c-a' : 'c-b',
      session: i < 2 ? 'clinic-a' : 'clinic-b',
      container: i < 2 ? 'clinics-1' : 'clinics-2',
      patientId: `p${String(i)}`,
      phone: generatePhone(random, 'SY'),
    }));
    for (const p of patients) config.allowlist.add(p.phone);

    const producer = await createMessaging(config);
    opened.producer = producer;
    const url = await producer.listen();
    for (const [container, fake] of Object.entries(fakes)) {
      fake.setWebhookUrl(`${url}/webhooks/${container}`);
    }
    for (const s of sessions) await fakes[s.container]?.addWorkingSession(s.name);
    for (const p of patients) {
      await producer.registerPatient(p.clinicId, p.patientId, p.phone);
      const res = await fakes[p.container]?.inbound(p.session, {
        from: `${p.phone.slice(1)}@c.us`,
        body: 'مرحبا',
      });
      expect(res?.status).toBe(200);
    }

    opened.workers.push(
      spawnWorker({ ...config, queue: 'worker' }),
      spawnWorker({ ...config, queue: 'worker' }),
    );
    await Promise.all(opened.workers.map((w) => w.ready));

    // Session A: 12 messages, short and long in turn; session B: 6.
    const expected: Record<string, string[]> = { 'clinic-a': [], 'clinic-b': [] };
    for (let i = 0; i < 18; i++) {
      const p = i < 12 ? patients[i % 2] : patients[2 + (i % 2)];
      if (!p) throw new Error('patient');
      const marker = `م${String(i).padStart(2, '0')}`;
      const name = i % 2 === 0 ? marker : `${marker}${'ـس'.repeat(60)}`;
      const result = await producer.sendWhatsApp(p.clinicId, p.patientId, 'appointment_reminder', {
        name,
        date: '2026-11-18',
        time: '10:30',
      });
      expect(result.status).toBe('queued');
      expected[p.session]?.push(marker);
    }

    const deadline = Date.now() + 90_000;
    for (;;) {
      const rows = await producer.query<{ n: number }>(
        "select count(*)::int as n from s5.delivery_attempt where status = 'sent'",
      );
      if (rows[0]?.n === 18) break;
      if (Date.now() > deadline) throw new Error(`only ${String(rows[0]?.n)} of 18 sent`);
      await sleep(250);
    }

    const sends: Record<string, FakeCall[]> = {};
    for (const s of sessions) {
      const calls = (fakes[s.container]?.calls ?? []).filter((c) => c.session === s.name);
      const texts = calls.filter((c) => c.path === '/api/sendText');
      sends[s.name] = texts;
      // FIFO.
      expect(
        texts.map((c) => /م\d\d/.exec(c.text ?? '')?.[0]),
        s.name,
      ).toEqual(expected[s.name]);
      // seen → typing → send, one sequence at a time.
      const seq = calls.filter((c) => PACED.includes(c.path));
      const order = seq.map((c) => c.path);
      expect(order.length).toBe(texts.length * 4);
      for (let i = 0; i < texts.length; i++) {
        expect(order.slice(i * 4, i * 4 + 4)).toEqual([
          '/api/sendSeen',
          '/api/startTyping',
          '/api/stopTyping',
          '/api/sendText',
        ]);
      }
      for (let i = 1; i < seq.length; i++) {
        expect(seq[i]?.at ?? 0).toBeGreaterThanOrEqual(seq[i - 1]?.endedAt ?? 0);
      }
      // Gap, cap, quiet window.
      for (let i = 1; i < texts.length; i++) {
        expect((texts[i]?.at ?? 0) - (texts[i - 1]?.at ?? 0)).toBeGreaterThanOrEqual(195);
      }
      for (const c of texts) {
        expect(
          texts.filter((o) => o.at > c.at - pacing.windowMs + 50 && o.at <= c.at).length,
        ).toBeLessThanOrEqual(6);
        expect(c.at >= quiet.from && c.at < quiet.to, 'send in quiet window').toBe(false);
      }
      // Typing grows with length.
      const typing = (parity: number) => {
        const starts = calls.filter((c) => c.path === '/api/startTyping');
        const stops = calls.filter((c) => c.path === '/api/stopTyping');
        const d = starts
          .map((c, i) => (stops[i]?.at ?? 0) - c.at)
          .filter((_, i) => i % 2 === parity);
        return d.reduce((a, b) => a + b, 0) / d.length;
      };
      if (s.name === 'clinic-a') expect(typing(1)).toBeGreaterThan(typing(0) + 100);
    }

    // The two sessions ran side by side, not one after the other.
    const a = sends['clinic-a'] ?? [];
    const b = sends['clinic-b'] ?? [];
    const aFirst = a[0]?.at ?? 0;
    const aLast = a.at(-1)?.at ?? 0;
    expect(b.some((c) => c.at > aFirst && c.at < aLast)).toBe(true);
  });
});
