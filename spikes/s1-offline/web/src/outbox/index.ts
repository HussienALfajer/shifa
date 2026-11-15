// Custom outbox engine (ADR-0014 option b): commands and today's rows in IndexedDB; upload in
// order to POST /commands, then pull changes since the cursor. A network error keeps the queue and
// retries the same ids (idempotent on the server); a 401 keeps the queue until a new login.
import type { CommandResult, Session, SyncEngine, SyncEvent, SyncStatus } from '../engine.ts';
import { toAppointment, toMovement, toSession, toTicket } from '../rows.ts';
import {
  applyLocally,
  destroyStore,
  type OutboxDb,
  openStore,
  putRow,
  readToday,
  setRealNumber,
  undoCreate,
} from './store.ts';

export interface OutboxOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  dbName?: string;
  /** Background sync period; 0 disables the loop (tests call sync()). */
  backgroundMs?: number;
  /** Per-request timeout. */
  timeoutMs?: number;
}

const BATCH = 200;

class Unauthorized extends Error {}

export function createOutboxEngine(options: OutboxOptions): SyncEngine {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const dbName = options.dbName ?? 's1-outbox';
  const listeners = new Set<(e: SyncEvent) => void>();
  let db: OutboxDb | undefined;
  let session: Session | undefined;
  let needsLogin = false;
  let offlineSince: number | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let running: Promise<void> | undefined;

  const store = (): OutboxDb => {
    if (!db) throw new Error('engine not started');
    return db;
  };

  async function call(path: string, init?: RequestInit): Promise<unknown> {
    if (!session) throw new Unauthorized();
    const res = await doFetch(`${options.baseUrl}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs ?? 20_000),
    });
    if (res.status === 401) throw new Unauthorized();
    if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
    return res.json();
  }

  async function record(event: SyncEvent): Promise<void> {
    await store().add('events', { event });
    for (const l of listeners) l(event);
  }

  async function applyResult(seq: number, result: CommandResult): Promise<void> {
    const entry = await store().get('commands', seq);
    if (!entry) return;
    const { command } = entry;
    if (result.status === 'applied' && result.remap) {
      await setRealNumber(store(), result.remap.ticketId, result.remap.real);
      await record({ kind: 'remap', commandId: command.id, ...result.remap });
    } else if (result.status !== 'applied') {
      await undoCreate(store(), command);
      await record({
        kind: result.status,
        commandId: command.id,
        code: result.conflict?.code ?? 'unknown',
        messageAr: result.conflict?.messageAr ?? '',
      });
    }
    await store().delete('commands', seq);
  }

  async function flush(): Promise<void> {
    for (;;) {
      const queued = (await store().getAll('commands', undefined, BATCH)).filter(
        (e): e is typeof e & { seq: number } => e.seq !== undefined,
      );
      if (queued.length === 0) return;
      const body = JSON.stringify({ commands: queued.map((e) => e.command) });
      const { results } = (await call('/commands', { method: 'POST', body })) as {
        results: CommandResult[];
      };
      for (const [i, entry] of queued.entries()) {
        const result = results[i];
        if (result?.id === entry.command.id) await applyResult(entry.seq, result);
      }
    }
  }

  async function pull(): Promise<void> {
    // Local stores keep only today's data: a new clinic day drops the old rows and takes a fresh
    // snapshot (the queue is empty here, so no optimistic row is lost).
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(new Date());
    const storedDay = await store().get('meta', 'day');
    if (storedDay !== undefined && storedDay !== day) {
      await store().clear('rows');
      await store().delete('meta', 'cursor');
    }
    if (storedDay !== day) await store().put('meta', day, 'day');
    const cursor = (await store().get('meta', 'cursor')) as string | undefined;
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const body = (await call(`/sync/pull${query}`)) as {
      cursor: string;
      rows: Record<string, Record<string, unknown>[]>;
    };
    const d = store();
    // Pull runs only after flush emptied the queue, so server rows can replace optimistic ones.
    for (const r of body.rows['queue_ticket'] ?? []) await putRow(d, 'queue_ticket', toTicket(r));
    for (const r of body.rows['appointment'] ?? [])
      await putRow(d, 'appointment', toAppointment(r));
    for (const r of body.rows['cash_session'] ?? []) await putRow(d, 'cash_session', toSession(r));
    for (const r of body.rows['cash_movement'] ?? [])
      await putRow(d, 'cash_movement', toMovement(r));
    await d.put('meta', body.cursor, 'cursor');
  }

  async function goOffline(): Promise<void> {
    if (offlineSince === undefined) {
      offlineSince = Date.now();
      await store().put('meta', offlineSince, 'offlineSince');
    }
  }

  async function round(): Promise<void> {
    if (!db || !session || needsLogin) return;
    try {
      await flush();
      await pull();
      offlineSince = undefined;
      await store().delete('meta', 'offlineSince');
    } catch (err) {
      if (err instanceof Unauthorized) {
        needsLogin = true;
        return;
      }
      await goOffline();
    }
  }

  const engine: SyncEngine = {
    async start(next) {
      db ??= await openStore(dbName);
      session = next;
      needsLogin = false;
      const since = await db.get('meta', 'offlineSince');
      offlineSince = typeof since === 'number' ? since : undefined;
      const period = options.backgroundMs ?? 3_000;
      if (period > 0 && !timer) timer = setInterval(() => void engine.sync(), period);
    },
    async enqueue(command) {
      await store().add('commands', { command });
      await applyLocally(store(), command);
    },
    sync() {
      // One round at a time; a caller during a round waits for it.
      running ??= round().finally(() => {
        running = undefined;
      });
      return running;
    },
    today: () => readToday(store()),
    pendingCount: () => store().count('commands'),
    status(): SyncStatus {
      if (needsLogin)
        return offlineSince === undefined
          ? { state: 'needs-login' }
          : { state: 'needs-login', offlineSince };
      return offlineSince === undefined ? { state: 'online' } : { state: 'offline', offlineSince };
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async events() {
      return (await store().getAll('events')).map((e) => e.event);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    async wipe() {
      engine.stop();
      await destroyStore(db, dbName);
      db = undefined;
      session = undefined;
      offlineSince = undefined;
    },
  };
  return engine;
}
