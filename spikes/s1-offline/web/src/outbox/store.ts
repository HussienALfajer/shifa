// IndexedDB layout of the outbox engine (via `idb`): the command queue, today's rows, the events
// staff must see, and a small meta store (cursor, time offline).
import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from 'idb';
import type {
  AppointmentRow,
  CashSessionRow,
  Command,
  MovementRow,
  SyncEvent,
  TicketRow,
  Today,
} from '../engine.ts';

type Table = 'appointment' | 'queue_ticket' | 'cash_session' | 'cash_movement';
type AnyRow = AppointmentRow | TicketRow | CashSessionRow | MovementRow;

interface OutboxSchema extends DBSchema {
  commands: { key: number; value: { seq?: number; command: Command } };
  rows: { key: string; value: { key: string; table: Table; row: AnyRow } };
  events: { key: number; value: { seq?: number; event: SyncEvent } };
  meta: { key: string; value: unknown };
}

export type OutboxDb = IDBPDatabase<OutboxSchema>;

export async function openStore(name: string): Promise<OutboxDb> {
  const db: OutboxDb = await openDB<OutboxSchema>(name, 1, {
    upgrade(upgrading) {
      upgrading.createObjectStore('commands', { keyPath: 'seq', autoIncrement: true });
      upgrading.createObjectStore('rows', { keyPath: 'key' });
      upgrading.createObjectStore('events', { keyPath: 'seq', autoIncrement: true });
      upgrading.createObjectStore('meta');
    },
    // Another tab logging out deletes the database: let it, instead of blocking the wipe.
    blocking() {
      db.close();
    },
  });
  return db;
}

export async function destroyStore(db: OutboxDb | undefined, name: string): Promise<void> {
  db?.close();
  await deleteDB(name);
}

const key = (table: Table, id: string) => `${table}:${id}`;

async function patch<T extends AnyRow>(db: OutboxDb, table: Table, id: string, change: Partial<T>) {
  const existing = await db.get('rows', key(table, id));
  if (!existing) return;
  await db.put('rows', { ...existing, row: { ...existing.row, ...change } });
}

export async function putRow(db: OutboxDb, table: Table, row: AnyRow): Promise<void> {
  await db.put('rows', { key: key(table, row.id), table, row });
}

/** Optimistic local effect of a command, so the screen shows it before any sync. */
export async function applyLocally(db: OutboxDb, c: Command): Promise<void> {
  switch (c.type) {
    case 'ticket.issue':
      return putRow(db, 'queue_ticket', {
        id: c.payload.ticketId,
        practitionerId: c.payload.practitionerId,
        shiftDate: c.payload.shiftDate,
        provisionalNumber: c.payload.provisionalNumber,
        deviceId: c.deviceId,
        status: 'waiting',
        walkInLabel: c.payload.walkInLabel,
      });
    case 'ticket.status':
      return patch<TicketRow>(db, 'queue_ticket', c.payload.ticketId, { status: c.payload.status });
    case 'appointment.book':
      return putRow(db, 'appointment', {
        id: c.payload.appointmentId,
        practitionerId: c.payload.practitionerId,
        ...(c.payload.patientId ? { patientId: c.payload.patientId } : {}),
        start: c.payload.start,
        end: c.payload.end,
        status: 'booked',
      });
    case 'appointment.cancel':
      return patch<AppointmentRow>(db, 'appointment', c.payload.appointmentId, {
        status: 'cancelled',
      });
    case 'cash.open':
      return putRow(db, 'cash_session', {
        id: c.payload.sessionId,
        rates: c.payload.rates,
        closed: false,
      });
    case 'cash.close':
      return patch<CashSessionRow>(db, 'cash_session', c.payload.sessionId, { closed: true });
    case 'cash.move':
      return putRow(db, 'cash_movement', {
        id: c.payload.movementId,
        sessionId: c.payload.sessionId,
        type: c.payload.type,
        currency: c.payload.currency,
        amountMinor: c.payload.amountMinor,
        rateUsed: c.payload.rateUsed,
        offline: c.offline,
        ...(c.payload.refundOf ? { refundOf: c.payload.refundOf } : {}),
      });
  }
}

/** Removes the optimistic row a refused or conflicting create command made. */
export async function undoCreate(db: OutboxDb, c: Command): Promise<void> {
  const target = createdRow(c);
  if (target) await db.delete('rows', key(...target));
}

/** The row a create command makes, or undefined for an update command. */
export function createdRow(c: Command): [Table, string] | undefined {
  switch (c.type) {
    case 'ticket.issue':
      return ['queue_ticket', c.payload.ticketId];
    case 'appointment.book':
      return ['appointment', c.payload.appointmentId];
    case 'cash.open':
      return ['cash_session', c.payload.sessionId];
    case 'cash.move':
      return ['cash_movement', c.payload.movementId];
    case 'ticket.status':
    case 'appointment.cancel':
    case 'cash.close':
      return undefined;
  }
}

export async function setRealNumber(db: OutboxDb, ticketId: string, real: number): Promise<void> {
  await patch<TicketRow>(db, 'queue_ticket', ticketId, { realNumber: real });
}

export async function readToday(db: OutboxDb): Promise<Today> {
  const all = await db.getAll('rows');
  const of = <T extends AnyRow>(table: Table) =>
    all.filter((r) => r.table === table).map((r) => r.row as T);
  const tickets = of<TicketRow>('queue_ticket').sort(
    (a, b) =>
      (a.realNumber ?? Number.MAX_SAFE_INTEGER) - (b.realNumber ?? Number.MAX_SAFE_INTEGER) ||
      a.provisionalNumber - b.provisionalNumber,
  );
  return {
    tickets,
    appointments: of<AppointmentRow>('appointment').sort((a, b) => a.start.localeCompare(b.start)),
    sessions: of<CashSessionRow>('cash_session'),
    movements: of<MovementRow>('cash_movement'),
  };
}
