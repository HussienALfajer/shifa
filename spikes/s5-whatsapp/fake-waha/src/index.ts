// Fake WAHA (criterion 2): one instance stands for one WAHA container. It serves the endpoints
// the spike uses and emits signed webhooks; every fault the spec names can be injected, from
// the test process (methods below) or over HTTP (POST /__fake/<method> {"args": [...]}).
import {
  envelope,
  type InboundInput,
  inboundPayload,
  ackPayload,
  type SessionStatus,
} from './events.ts';
import { buildServer } from './server.ts';
import { type FakeCall, FakeState, type SendMode } from './state.ts';
import { type Delivery, type DeliveryOptions, WebhookEmitter } from './webhooks.ts';

export type { FakeCall, SendMode } from './state.ts';
export type { Delivery, DeliveryOptions } from './webhooks.ts';
export type { InboundInput } from './events.ts';

export interface FakeWahaOptions {
  /** Logical container name (`platform`, `clinics`, ...). */
  container: string;
  apiKey: string;
  hmacKey: string;
  webhookUrl: string;
  now?: () => number;
  log?: (line: string) => void;
  port?: number;
}

export type CappingStatus = 'NONE' | 'FIRST_WARNING' | 'SECOND_WARNING' | 'CAPPED';

export interface FakeWaha {
  url: string;
  container: string;
  calls: FakeCall[];
  servedRoutes(): { method: string; path: string }[];
  webhookUrl(): string;
  setWebhookUrl(url: string): void;
  /** A session that is already linked and WORKING (no webhook). */
  addWorkingSession(name: string): Promise<void>;
  inbound(session: string, input: InboundInput, options?: DeliveryOptions): Promise<Delivery>;
  status(
    session: string,
    status: string,
    options?: { emit?: boolean },
  ): Promise<Delivery | undefined>;
  capping(session: string, status: CappingStatus): Promise<Delivery>;
  timelock(session: string, active: boolean): Promise<Delivery>;
  ack(
    session: string,
    messageId: string,
    ack: number,
    options?: { error?: number },
  ): Promise<Delivery>;
  replay(eventId: string): Promise<Delivery>;
  holdWebhooks(): void;
  releaseWebhooks(options?: { reverse?: boolean }): Promise<void>;
  duplicateNext(): void;
  setSendMode(session: string, mode: SendMode): void;
  setDown(down: boolean): void;
  releaseHung(): void;
  registerLid(session: string, lid: string, pn: string | null): void;
  waitForCall(path: string, timeoutMs: number): Promise<FakeCall>;
  close(): Promise<void>;
}

export async function startFakeWaha(options: FakeWahaOptions): Promise<FakeWaha> {
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  const state = new FakeState(now);
  const emitter = new WebhookEmitter(options.webhookUrl, options.hmacKey, log);
  const need = (name: string) => {
    const s = state.session(name);
    if (!s) throw new Error('unknown session');
    return s;
  };
  const statusEvent = (name: string, options: DeliveryOptions = {}) => {
    const s = need(name);
    const timelock = s.me.reachoutTimelock;
    const data =
      s.status === 'WORKING' && timelock?.isActive ? { reachoutTimelock: timelock } : null;
    const payload = { name, status: s.status, statuses: s.statuses, data };
    return emitter.deliver(envelope('session.status', name, s.me, payload, now()), options);
  };

  const fake: FakeWaha = {
    url: '',
    container: options.container,
    calls: state.calls,
    servedRoutes: () => [...routes],
    webhookUrl: () => emitter.url,
    setWebhookUrl(url) {
      emitter.url = url;
    },
    async addWorkingSession(name) {
      const s = state.create(name, true);
      state.start(s);
      return Promise.resolve();
    },
    inbound(session, input, deliveryOptions) {
      const s = need(session);
      const { event, payload } = inboundPayload(input, s.me.id, Math.floor(now() / 1000));
      return emitter.deliver(envelope(event, session, s.me, payload, now()), deliveryOptions);
    },
    async status(session, status, statusOptions = {}) {
      const s = state.session(session) ?? state.create(session, true);
      state.setStatus(s, status as SessionStatus);
      if (statusOptions.emit === false) return undefined;
      return statusEvent(session);
    },
    capping(session, cappingStatus) {
      const s = need(session);
      const cycleStart = Math.floor(now() / 1000);
      s.me = {
        ...s.me,
        messageCapping: {
          cappingStatus,
          totalQuota: 1000,
          usedQuota: cappingStatus === 'NONE' ? 10 : 990,
          cycleStart,
          cycleEnd: cycleStart + 30 * 86_400,
          mvStatus: 'NOT_ELIGIBLE',
          oteStatus: 'NOT_ELIGIBLE',
        },
      };
      return statusEvent(session);
    },
    timelock(session, active) {
      const s = need(session);
      const ends = active ? Math.floor(now() / 1000) + 86_400 : null;
      s.me = {
        ...s.me,
        reachoutTimelock: {
          enforcementType: 'DEFAULT',
          isActive: active,
          timeEnforcementEnds: ends,
        },
      };
      return statusEvent(session);
    },
    ack(session, messageId, ack, ackOptions = {}) {
      const s = need(session);
      const payload = ackPayload(messageId, ack, ackOptions.error);
      return emitter.deliver(envelope('message.ack', session, s.me, payload, now()));
    },
    replay: (eventId) => emitter.replay(eventId),
    holdWebhooks: () => {
      emitter.hold();
    },
    releaseWebhooks: (releaseOptions = {}) => emitter.release(releaseOptions.reverse ?? false),
    duplicateNext: () => {
      emitter.duplicateNext();
    },
    setSendMode(session, mode) {
      need(session).sendMode = mode;
    },
    setDown(down) {
      state.down = down;
    },
    releaseHung() {
      for (const release of state.hung.splice(0)) release();
    },
    registerLid(session, lid, pn) {
      need(session).lids.set(lid, pn);
    },
    async waitForCall(path, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const call = state.calls.find((c) => c.path === path);
        if (call) return call;
        if (Date.now() > deadline) throw new Error(`no call to ${path}`);
        await new Promise((r) => setTimeout(r, 50));
      }
    },
    async close() {
      fake.releaseHung();
      await app.close();
    },
  };

  const control = async (action: string, args: unknown[]): Promise<unknown> => {
    const allowed = [
      'inbound',
      'status',
      'capping',
      'timelock',
      'ack',
      'setSendMode',
      'setDown',
      'releaseHung',
      'registerLid',
      'duplicateNext',
    ];
    if (!allowed.includes(action)) throw new Error('unknown action');
    const fn = (fake as unknown as Record<string, (...a: unknown[]) => unknown>)[action];
    return fn ? await fn(...args) : undefined;
  };
  const { app, routes } = buildServer({ apiKey: options.apiKey, state, control });
  fake.url = await app.listen({ host: '127.0.0.1', port: options.port ?? 0 });
  return fake;
}
