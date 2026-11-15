// Shared setup for the spike server's DB tests: the `s1` schema on this worker's database, a
// server on testDb() (shifa_app), synthetic identities and small command builders.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ownerDb, testDb } from '@shifa/db/testing';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll } from 'vitest';
import type { Command, CommandResult } from '../src/commands.ts';
import { buildServer, type Identities, syntheticIdentities } from '../src/index.ts';

const SCHEMA = new URL('../sql/schema.sql', import.meta.url);

export async function applySchema(): Promise<void> {
  // No parameters, so pg sends the whole file in one simple-protocol query.
  await ownerDb().execute(sql.raw(await readFile(SCHEMA, 'utf8')));
}

export interface TestServer {
  app: FastifyInstance;
  ids: Identities;
  logs: Record<string, unknown>[];
  login(tenant?: 'A' | 'B'): Promise<string>;
  post(token: string, commands: unknown[]): Promise<{ status: number; results: CommandResult[] }>;
}

/** Starts a server per file (schema applied, practitioners seeded) and closes it afterwards. */
export function useServer(options: { tokenTtlSeconds?: number } = {}): TestServer {
  const state = {} as TestServer;
  state.logs = [];
  beforeAll(async () => {
    await applySchema();
    state.ids = syntheticIdentities();
    state.app = await buildServer({
      db: testDb(),
      identities: state.ids,
      tokenTtlSeconds: options.tokenTtlSeconds ?? 600,
      log: (line) => state.logs.push(line),
    });
    await state.app.ready();
  });
  afterAll(async () => {
    await state.app.close();
  });
  state.login = async (tenant = 'A') => {
    const who = state.ids[tenant].receptionist.username;
    const res = await state.app.inject({
      method: 'POST',
      url: '/auth/login',
      body: { username: who },
    });
    return res.json<{ token: string }>().token;
  };
  state.post = async (token, commands) => {
    const res = await state.app.inject({
      method: 'POST',
      url: '/commands',
      headers: { authorization: `Bearer ${token}` },
      body: { commands },
    });
    const body = res.statusCode === 200 ? res.json<{ results: CommandResult[] }>() : undefined;
    return { status: res.statusCode, results: body?.results ?? [] };
  };
  return state;
}

/** The clinic's date (Asia/Damascus), which the pull endpoint calls "today". */
export const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus' }).format(
  new Date(),
);

let clientSeconds = 0;
function envelope(deviceId: string, offline: boolean) {
  clientSeconds += 1;
  return {
    id: randomUUID(),
    deviceId,
    offline,
    clientTime: new Date(Date.UTC(2026, 10, 15, 8, 0, clientSeconds)).toISOString(),
  };
}

export const cmd = {
  issue(deviceId: string, practitionerId: string, provisionalNumber: number): Command {
    return {
      ...envelope(deviceId, true),
      type: 'ticket.issue',
      payload: {
        ticketId: randomUUID(),
        practitionerId,
        shiftDate: TODAY,
        provisionalNumber,
        walkInLabel: `مراجع ${String(provisionalNumber)}`,
      },
    };
  },
  status(deviceId: string, ticketId: string, status: 'called' | 'done'): Command {
    return { ...envelope(deviceId, true), type: 'ticket.status', payload: { ticketId, status } };
  },
  book(practitionerId: string, start: string, end: string, offline = true): Command {
    return {
      ...envelope('dev-1', offline),
      type: 'appointment.book',
      payload: { appointmentId: randomUUID(), practitionerId, start, end },
    };
  },
  cancel(appointmentId: string): Command {
    return { ...envelope('dev-1', true), type: 'appointment.cancel', payload: { appointmentId } };
  },
  open(sessionId: string, offline = false): Command {
    return {
      ...envelope('dev-1', offline),
      type: 'cash.open',
      payload: { sessionId, rates: { SYP: '11000', TRY: '41.5', USD: '1' } },
    };
  },
  close(sessionId: string, offline: boolean): Command {
    return { ...envelope('dev-1', offline), type: 'cash.close', payload: { sessionId } };
  },
  move(
    sessionId: string,
    type: 'sale' | 'refund' | 'expense' | 'deposit' | 'float_adjust',
    currency: 'SYP' | 'TRY' | 'USD',
    amountMinor: bigint,
    options: { offline?: boolean; refundOf?: string; rate?: string } = {},
  ): Command {
    const rates = { SYP: '11000', TRY: '41.5', USD: '1' };
    return {
      ...envelope('dev-1', options.offline ?? true),
      type: 'cash.move',
      payload: {
        movementId: randomUUID(),
        sessionId,
        type,
        currency,
        amountMinor: amountMinor.toString(),
        rateUsed: options.rate ?? rates[currency],
        ...(options.refundOf ? { refundOf: options.refundOf } : {}),
      },
    };
  },
};

/** Reads rows of an `s1` table for a tenant, as shifa_app under withTenant(). */
export async function rowsOf<T extends Record<string, unknown>>(
  tenantId: string,
  query: ReturnType<typeof sql>,
): Promise<T[]> {
  return testDb().withTenant({ tenantId, userId: randomUUID() }, async (tx) => {
    const { rows } = await tx.execute<T>(query);
    return rows;
  });
}
