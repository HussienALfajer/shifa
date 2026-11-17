// Per-test environment: a fresh database on the file's PostgreSQL 18 container, one fake WAHA
// per container (clinics, platform), the messaging service listening on 127.0.0.1 so the fakes
// post signed webhooks to it, a manual clock and a seeded random source.
import { randomBytes } from 'node:crypto';
import { createRandom, generatePhone, isSyntheticPhone } from '@shifa/testing';
import { type FakeWaha, startFakeWaha } from '@shifa-spike/s5-fake-waha';
import { type MessagingDb, startMessagingDb } from '@shifa-spike/s5-stack';
import { afterAll, afterEach, beforeAll } from 'vitest';
import {
  createMessaging,
  type Messaging,
  type MessagingConfig,
  type PacingConfig,
  type SessionConfig,
} from '../src/index.ts';

/** The fake's first own number (`9639900` + counter), a synthetic Syrian mobile. */
export const PLATFORM_NUMBER = '+963990000001';

export const START = Date.parse('2026-11-17T10:00:00+03:00');

export class ManualClock {
  constructor(private t = START) {}
  now = (): number => this.t;
  advance = (ms: number): void => {
    this.t += ms;
  };
  set = (t: number): void => {
    this.t = t;
  };
}

export const INSTANT_PACING: PacingConfig = {
  minGapMs: 0,
  maxGapMs: 0,
  capPerWindow: 10_000,
  windowMs: 3_600_000,
  quiet: { kind: 'none' },
  deferSpreadMs: 0,
  typing: { perCharMs: 0, minMs: 0, maxMs: 0 },
  inlineWaitMaxMs: 0,
};

export const SESSIONS: SessionConfig[] = [
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
  {
    name: 'platform',
    container: 'platform',
    clinicId: null,
    role: 'platform',
    timeZone: 'Asia/Damascus',
  },
];

export interface Patient {
  clinicId: string;
  patientId: string;
  phone: string;
  /** WhatsApp chat id of the phone: digits@c.us. */
  chatId: string;
}

export interface EnvOptions {
  pacing?: PacingConfig;
  sendTimeoutMs?: number;
  sessions?: SessionConfig[];
  /** Raw webhook capture folder (manual-run tooling, 0.3-S5b). */
  rawCaptureDir?: string;
  /** Sessions the fakes do not know yet (as on a fresh WAHA container). */
  unlinked?: string[];
}

/** One fake per container; the default sessions use `clinics` and `platform`. */
export type Fakes = Record<string, FakeWaha> & { clinics?: FakeWaha; platform?: FakeWaha };

export interface Env {
  messaging: Messaging;
  /** Base URL of the service on 127.0.0.1. */
  url: string;
  config: MessagingConfig;
  fakes: Fakes;
  clock: ManualClock;
  logs: string[];
  allowlist: Set<string>;
  patient(clinicId: string, options?: { allowlisted?: boolean }): Promise<Patient>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs ticks for a session until it has nothing to send now. */
  drain(session: string): Promise<void>;
  close(): Promise<void>;
}

const secret = () => randomBytes(18).toString('base64url');

/** One PostgreSQL container per test file; `newEnv` gives each test its own database. */
export function useDatabase(): { readonly db: MessagingDb } {
  const holder = {} as { db?: MessagingDb };
  beforeAll(async () => {
    holder.db = await startMessagingDb();
  });
  afterAll(async () => {
    await holder.db?.stop();
  });
  return {
    get db() {
      if (!holder.db) throw new Error('database not started');
      return holder.db;
    },
  };
}

let envCount = 0;
let seed = 1;

export async function newEnv(db: MessagingDb, options: EnvOptions = {}): Promise<Env> {
  const clock = new ManualClock();
  const random = createRandom(seed++);
  const logs: string[] = [];
  const allowlist = new Set<string>();
  const sessions = options.sessions ?? SESSIONS;
  const containers = [...new Set(sessions.map((s) => s.container))];
  const keys = Object.fromEntries(
    containers.map((c) => [c, { apiKey: secret(), hmacKey: secret() }]),
  );
  const databaseUrl = await db.createDatabase(`t${String(++envCount)}_${String(process.pid)}`);

  const fakes: Fakes = {};
  for (const container of containers) {
    const key = keys[container];
    if (!key) throw new Error(container);
    fakes[container] = await startFakeWaha({
      container,
      ...key,
      webhookUrl: 'http://127.0.0.1:9/pending',
      now: clock.now,
      log: (line) => logs.push(line),
    });
  }
  const config: MessagingConfig = {
    databaseUrl,
    containers: Object.fromEntries(
      containers.map((c) => {
        const key = keys[c];
        const fake = fakes[c];
        if (!key || !fake) throw new Error(c);
        return [c, { wahaUrl: fake.url, apiKey: key.apiKey, hmacKey: key.hmacKey }];
      }),
    ),
    sessions,
    allowlist,
    pacing: options.pacing ?? INSTANT_PACING,
    sendTimeoutMs: options.sendTimeoutMs ?? 2_000,
    adminToken: secret(),
    queue: 'off',
    // The platform fake's only session gets the fake's first own number.
    verify: { platformNumber: PLATFORM_NUMBER, serverKey: secret() },
    ...(options.rawCaptureDir ? { rawCaptureDir: options.rawCaptureDir } : {}),
  };
  const messaging = await createMessaging(config, {
    now: clock.now,
    random: () => random.next(),
    sleep: (ms) => {
      clock.advance(ms);
      return Promise.resolve();
    },
    log: (line) => logs.push(line),
  });
  const url = await messaging.listen();
  for (const container of containers) {
    fakes[container]?.setWebhookUrl(`${url}/webhooks/${container}`);
  }
  for (const s of sessions) {
    if (!options.unlinked?.includes(s.name)) await fakes[s.container]?.addWorkingSession(s.name);
  }

  let patientCount = 0;
  return {
    messaging,
    url,
    config,
    fakes,
    clock,
    logs,
    allowlist,
    async patient(clinicId, { allowlisted = true } = {}) {
      const phone = generatePhone(random, 'SY');
      if (!isSyntheticPhone(phone)) throw new Error('not synthetic');
      const patientId = `p${String(++patientCount)}`;
      await messaging.registerPatient(clinicId, patientId, phone);
      if (allowlisted) allowlist.add(phone);
      return { clinicId, patientId, phone, chatId: `${phone.slice(1)}@c.us` };
    },
    query: (sql, params) => messaging.query(sql, params),
    async drain(session) {
      for (let i = 0; i < 1_000; i++) {
        const result = await messaging.tick(session);
        if (result === 'idle' || result === 'deferred') return;
        // Another holder of the session lock (a worker, or a killed one PostgreSQL has not
        // noticed yet): wait in real time.
        if (result === 'busy') await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error('drain did not settle');
    },
    async close() {
      await messaging.close();
      for (const fake of Object.values(fakes)) await fake.close();
    },
  };
}

/** Closes every env a test opened. */
export function useEnvs(): (env: Env) => Env {
  const open: Env[] = [];
  afterEach(async () => {
    for (const env of open.splice(0)) await env.close();
  });
  return (env) => {
    open.push(env);
    return env;
  };
}
