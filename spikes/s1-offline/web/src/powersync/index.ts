// PowerSync engine (ADR-0014 option a): local SQLite (wa-sqlite on IndexedDB) synced by the
// self-hosted PowerSync service through sync streams scoped by the JWT. Commands are inserted into
// the insert-only `outbox_command` table; the connector uploads them to the spike server's
// POST /powersync/upload (the shared command handler). Results come back as `offline_command`
// rows of this device.
import {
  type CommonPowerSyncDatabase,
  type PowerSyncBackendConnector,
  PowerSyncDatabase,
} from '@powersync/web';
import type { Session, SyncEngine, SyncEvent, SyncStatus, Today } from '../engine.ts';
import { toAppointment, toMovement, toSession, toTicket } from '../rows.ts';
import { applyLocally } from './local.ts';
import { schema } from './schema.ts';

export interface PowerSyncOptions {
  /** The spike server (uploads). */
  baseUrl: string;
  /** The PowerSync service (download stream). */
  endpoint: string;
  dbFilename?: string;
}

const OFFLINE_KEY = 's1-ps-offline-since';
type Row = Record<string, unknown>;

function eventsFrom(rows: Row[]): SyncEvent[] {
  const events: SyncEvent[] = [];
  for (const r of rows) {
    const result = JSON.parse(String(r['result'])) as {
      status: string;
      remap?: { ticketId: string; provisional: number; real: number };
      conflict?: { code: string; messageAr: string };
    };
    const commandId = String(r['id']);
    if (result.remap) events.push({ kind: 'remap', commandId, ...result.remap });
    if (result.status === 'conflict' || result.status === 'refused') {
      events.push({
        kind: result.status,
        commandId,
        code: result.conflict?.code ?? 'unknown',
        messageAr: result.conflict?.messageAr ?? '',
      });
    }
  }
  return events;
}

export function createPowerSyncEngine(options: PowerSyncOptions): SyncEngine {
  const db = new PowerSyncDatabase({
    schema,
    database: { dbFilename: options.dbFilename ?? 's1-powersync.db' },
  });
  const listeners = new Set<(e: SyncEvent) => void>();
  const seen = new Set<string>();
  let session: Session | undefined;
  let needsLogin = false;
  let offlineSince = Number(localStorage.getItem(OFFLINE_KEY) ?? '') || undefined;
  let stopWatch: (() => void) | undefined;

  const markOffline = () => {
    if (offlineSince === undefined) {
      offlineSince = Date.now();
      localStorage.setItem(OFFLINE_KEY, String(offlineSince));
    }
  };
  const markOnline = () => {
    offlineSince = undefined;
    localStorage.removeItem(OFFLINE_KEY);
  };

  const connector: PowerSyncBackendConnector = {
    fetchCredentials: async () => {
      await Promise.resolve();
      return session && !needsLogin ? { endpoint: options.endpoint, token: session.token } : null;
    },
    async uploadData(database: CommonPowerSyncDatabase) {
      const batch = await database.getCrudBatch(200);
      if (!batch || !session) return;
      let res: Response;
      try {
        res = await fetch(`${options.baseUrl}/powersync/upload`, {
          method: 'POST',
          headers: { authorization: `Bearer ${session.token}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            batch: batch.crud.map((e) => ({ op: e.op, type: e.table, id: e.id, data: e.opData })),
          }),
          signal: AbortSignal.timeout(20_000),
        });
      } catch (err) {
        markOffline();
        throw err;
      }
      if (res.status === 401) {
        // Keep the queue; nothing uploads until a new login (criterion 9).
        needsLogin = true;
        throw new Error('needs login');
      }
      if (!res.ok) throw new Error(`upload failed: ${String(res.status)}`);
      await batch.complete();
    },
  };

  async function emitNew(): Promise<void> {
    const rows = await db.getAll<Row>('SELECT id, result FROM offline_command');
    for (const e of eventsFrom(rows)) {
      const key = `${e.kind}:${e.commandId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const l of listeners) l(e);
    }
  }

  async function connect(): Promise<void> {
    if (!session) return;
    await db.connect(connector, {
      params: { device_id: session.deviceId },
      crudUploadThrottleMs: 300,
      retryDelayMs: 2_000,
    });
  }

  const engine: SyncEngine = {
    async start(next) {
      session = next;
      needsLogin = false;
      await db.init();
      for (const e of eventsFrom(await db.getAll<Row>('SELECT id, result FROM offline_command'))) {
        seen.add(`${e.kind}:${e.commandId}`);
      }
      db.registerListener({
        statusChanged: (status) => {
          if (status.connected && !status.uploadError) markOnline();
          else if (!status.connecting || status.downloadError) markOffline();
        },
      });
      const abort = new AbortController();
      stopWatch = () => {
        abort.abort();
      };
      db.onChangeWithCallback(
        { onChange: () => void emitNew() },
        { tables: ['offline_command'], signal: abort.signal },
      );
      await db.disconnect();
      await connect();
    },
    async enqueue(command) {
      await db.writeTransaction(async (tx) => {
        await tx.execute(
          'INSERT INTO outbox_command (id, type, payload, device_id, offline, client_time) VALUES (?, ?, ?, ?, ?, ?)',
          [
            command.id,
            command.type,
            JSON.stringify(command.payload),
            command.deviceId,
            command.offline ? 1 : 0,
            command.clientTime,
          ],
        );
        await tx.execute('INSERT INTO pending_command (id, queued_at) VALUES (?, ?)', [
          command.id,
          command.clientTime,
        ]);
        await applyLocally(tx, command);
      });
    },
    async sync() {
      // PowerSync syncs on its own; a round here only refreshes the offline mark.
      await Promise.resolve();
      const status = db.currentStatus;
      if (status.connected && !status.uploadError && !needsLogin) markOnline();
    },
    async today(): Promise<Today> {
      const [tickets, appointments, sessions, movements] = await Promise.all([
        db.getAll<Row>(
          'SELECT * FROM queue_ticket ORDER BY coalesce(real_number, 1e9), provisional_number',
        ),
        db.getAll<Row>('SELECT * FROM appointment ORDER BY starts_at'),
        db.getAll<Row>('SELECT * FROM cash_session'),
        db.getAll<Row>('SELECT * FROM cash_movement'),
      ]);
      return {
        tickets: tickets.map(toTicket),
        appointments: appointments.map(toAppointment),
        sessions: sessions.map(toSession),
        movements: movements.map(toMovement),
      };
    },
    async pendingCount() {
      const row = await db.get<{ n: number }>(
        'SELECT count(*) AS n FROM pending_command WHERE id NOT IN (SELECT id FROM offline_command)',
      );
      return row.n;
    },
    status(): SyncStatus {
      const state = needsLogin ? 'needs-login' : offlineSince === undefined ? 'online' : 'offline';
      return offlineSince === undefined ? { state } : { state, offlineSince };
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async events() {
      return eventsFrom(await db.getAll<Row>('SELECT id, result FROM offline_command'));
    },
    stop() {
      stopWatch?.();
    },
    async wipe() {
      stopWatch?.();
      await db.disconnectAndClear();
      session = undefined;
      seen.clear();
      markOnline();
    },
  };
  return engine;
}
