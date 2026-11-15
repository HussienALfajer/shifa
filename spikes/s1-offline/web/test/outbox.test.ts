// Criteria 8 and 9 on the custom outbox: the queue survives a new engine instance, a failed
// upload is retried with the same ids, a 401 keeps the queue, remaps keep the provisional number,
// and the pending count reaches zero.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Command, CommandResult, Session } from '../src/engine.ts';
import { createOutboxEngine } from '../src/outbox/index.ts';

const session = (token = 't1'): Session => ({
  token,
  deviceId: 'dev-1',
  tenantId: '00000000-0000-4000-8000-000000000001',
  branchId: '00000000-0000-4000-8000-000000000002',
});
const practitionerId = '00000000-0000-4000-8000-000000000003';

function issue(provisionalNumber: number): Command & { type: 'ticket.issue' } {
  return {
    id: randomUUID(),
    deviceId: 'dev-1',
    offline: true,
    clientTime: new Date().toISOString(),
    type: 'ticket.issue',
    payload: {
      ticketId: randomUUID(),
      practitionerId,
      shiftDate: '2026-11-15',
      provisionalNumber,
      walkInLabel: `مراجع ${String(provisionalNumber)}`,
    },
  };
}

type Mode = 'down' | 'up' | 'unauthorized' | 'fail-after-receive';

/** A fake server: records every uploaded command id, answers per mode. */
function fakeServer() {
  const uploads: string[][] = [];
  const applied = new Map<string, CommandResult>();
  let real = 0;
  const state = { mode: 'down' as Mode, uploads, applied };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    await Promise.resolve();
    const url = input instanceof Request ? input.url : input.toString();
    if (state.mode === 'down') throw new TypeError('Failed to fetch');
    if (state.mode === 'unauthorized') return json({ error: 'unauthenticated' }, 401);
    if (url.includes('/sync/pull')) {
      return json({
        cursor: new Date().toISOString(),
        rows: { appointment: [], queue_ticket: [], cash_session: [], cash_movement: [] },
      });
    }
    const { commands } = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as {
      commands: Command[];
    };
    uploads.push(commands.map((c) => c.id));
    const results = commands.map((c) => {
      const stored = applied.get(c.id);
      if (stored) return stored;
      const result: CommandResult = {
        id: c.id,
        status: 'applied',
        serverTime: new Date().toISOString(),
      };
      if (c.type === 'ticket.issue') {
        real += 1;
        if (real !== c.payload.provisionalNumber) {
          result.remap = {
            ticketId: c.payload.ticketId,
            provisional: c.payload.provisionalNumber,
            real,
          };
        }
      }
      applied.set(c.id, result);
      return result;
    });
    if (state.mode === 'fail-after-receive') {
      state.mode = 'up';
      throw new TypeError('connection reset');
    }
    return json({ results });
  };
  const fetch: typeof globalThis.fetch = fetchImpl;
  return { state, fetch };
}

const engineFor = (server: ReturnType<typeof fakeServer>, dbName: string) =>
  createOutboxEngine({ baseUrl: 'http://s1.test', fetch: server.fetch, dbName, backgroundMs: 0 });

describe('outbox engine', () => {
  it('keeps queued commands in a new engine instance (reload)', async () => {
    const server = fakeServer();
    const dbName = randomUUID();
    const first = engineFor(server, dbName);
    await first.start(session());
    for (const n of [1, 2, 3]) await first.enqueue(issue(n));
    await first.sync();
    expect(first.status().state).toBe('offline');
    first.stop();

    const second = engineFor(server, dbName);
    await second.start(session());
    expect(await second.pendingCount()).toBe(3);
    expect((await second.today()).tickets.map((t) => t.provisionalNumber)).toEqual([1, 2, 3]);
  });

  it('retries a failed upload with the same ids and applies each once', async () => {
    const server = fakeServer();
    const engine = engineFor(server, randomUUID());
    await engine.start(session());
    const commands = [issue(1), issue(2)];
    for (const c of commands) await engine.enqueue(c);
    server.state.mode = 'fail-after-receive';
    await engine.sync();
    expect(await engine.pendingCount()).toBe(2);
    await engine.sync();
    expect(server.state.uploads).toEqual([commands.map((c) => c.id), commands.map((c) => c.id)]);
    expect(server.state.applied.size).toBe(2);
    expect(await engine.pendingCount()).toBe(0);
  });

  it('keeps the queue on 401 and syncs only after a new login', async () => {
    const server = fakeServer();
    const engine = engineFor(server, randomUUID());
    await engine.start(session());
    await engine.enqueue(issue(1));
    server.state.mode = 'unauthorized';
    await engine.sync();
    expect(engine.status().state).toBe('needs-login');
    expect(await engine.pendingCount()).toBe(1);
    server.state.mode = 'up';
    await engine.sync();
    // Still blocked: the expired token is never retried by itself.
    expect(server.state.uploads).toHaveLength(0);
    await engine.start(session('t2'));
    await engine.sync();
    expect(await engine.pendingCount()).toBe(0);
    expect(engine.status().state).toBe('online');
  });

  it('keeps the provisional number next to the real one and reports the remap', async () => {
    const server = fakeServer();
    const engine = engineFor(server, randomUUID());
    await engine.start(session());
    const seen: string[] = [];
    engine.onEvent((e) => seen.push(e.kind));
    const ticket = issue(5);
    await engine.enqueue(ticket);
    const before = (await engine.today()).tickets[0];
    expect(before).toMatchObject({ provisionalNumber: 5 });
    expect(before?.realNumber).toBeUndefined();
    server.state.mode = 'up';
    await engine.sync();
    const after = (await engine.today()).tickets.find((t) => t.id === ticket.payload.ticketId);
    expect(after).toMatchObject({ provisionalNumber: 5, realNumber: 1 });
    expect(seen).toEqual(['remap']);
    expect(await engine.events()).toEqual([
      {
        kind: 'remap',
        commandId: ticket.id,
        ticketId: ticket.payload.ticketId,
        provisional: 5,
        real: 1,
      },
    ]);
  });

  it('tracks time offline and brings the pending count to zero after sync', async () => {
    const server = fakeServer();
    const engine = engineFor(server, randomUUID());
    await engine.start(session());
    await engine.enqueue(issue(1));
    await engine.sync();
    const since = engine.status().offlineSince;
    expect(since).toBeTypeOf('number');
    await engine.enqueue(issue(2));
    await engine.sync();
    expect(engine.status().offlineSince).toBe(since);
    expect(await engine.pendingCount()).toBe(2);
    server.state.mode = 'up';
    await engine.sync();
    expect(engine.status()).toEqual({ state: 'online' });
    expect(await engine.pendingCount()).toBe(0);
  });

  it('deletes the local store on wipe', async () => {
    const server = fakeServer();
    const dbName = randomUUID();
    const engine = engineFor(server, dbName);
    await engine.start(session());
    await engine.enqueue(issue(1));
    await engine.wipe();
    const again = engineFor(server, dbName);
    await again.start(session());
    expect(await again.pendingCount()).toBe(0);
    expect((await again.today()).tickets).toEqual([]);
  });
});
