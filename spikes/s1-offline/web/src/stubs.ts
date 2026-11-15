// Deliberately broken engines that prove the scenario suite catches loss and duplicates
// (slice 0.3-S1, checkpoint C). Built only with VITE_ENGINE=stub-drop or stub-dup.
import type { Command, CommandResult, SyncEngine } from './engine.ts';
import { createOutboxEngine } from './outbox/index.ts';

type Rewrite = (commands: Command[]) => Promise<CommandResult[]>;

function interceptingFetch(
  rewrite: (send: Rewrite, commands: Command[]) => Promise<CommandResult[]>,
): typeof fetch {
  const real = globalThis.fetch.bind(globalThis);
  return async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (!url.endsWith('/commands') || typeof init?.body !== 'string') return real(input, init);
    const send: Rewrite = async (commands) => {
      const res = await real(input, { ...init, body: JSON.stringify({ commands }) });
      if (!res.ok) throw Object.assign(new Error('upload failed'), { status: res.status });
      return ((await res.json()) as { results: CommandResult[] }).results;
    };
    const { commands } = JSON.parse(init.body) as { commands: Command[] };
    try {
      const results = await rewrite(send, commands);
      return new Response(JSON.stringify({ results }), {
        headers: { 'content-type': 'application/json' },
      });
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status) return new Response('{}', { status });
      throw err;
    }
  };
}

/** Loses every tenth command: reports it applied without sending it. */
export function createDroppingEngine(baseUrl: string): SyncEngine {
  let seen = 0;
  const fetch = interceptingFetch(async (send, commands) => {
    const kept = commands.filter(() => (seen += 1) % 10 !== 0);
    const results = await send(kept);
    return commands.map(
      (c) =>
        results.find((r) => r.id === c.id) ?? {
          id: c.id,
          status: 'applied',
          serverTime: new Date().toISOString(),
        },
    );
  });
  return createOutboxEngine({ baseUrl, fetch, dbName: 's1-stub-drop' });
}

/** Replays every batch with fresh ids (no idempotency key), so the server applies it twice. */
export function createDuplicatingEngine(baseUrl: string): SyncEngine {
  const fetch = interceptingFetch(async (send, commands) => {
    const fresh = () => commands.map((c) => ({ ...c, id: crypto.randomUUID() }));
    await send(fresh());
    const results = await send(fresh());
    return results.map((r, i) => ({ ...r, id: commands[i]?.id ?? r.id }));
  });
  return createOutboxEngine({ baseUrl, fetch, dbName: 's1-stub-dup' });
}
