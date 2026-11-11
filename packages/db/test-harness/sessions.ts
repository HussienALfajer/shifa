// Single raw sessions for the pooling leak tests (0.3-S2b): one `pg` Client per session, so a
// test can run session-level statements, leave a transaction open or kill the socket outright.
import { Client, type QueryResultRow } from 'pg';

/** One raw connection. Negative tests only: nothing here goes through withTenant(). */
export interface RawSession {
  /** One statement; `values` are bound parameters. Resolves to the rows. */
  query<T extends QueryResultRow = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<T[]>;
  /** Destroys the socket without a Terminate message, like a crashed client. */
  kill(): void;
  /** Closes the session politely; a no-op after kill() or a second end(). */
  end(): Promise<void>;
}

/** Opens a raw session on a guarded harness URL (the caller builds it with urlFor()). */
export async function openRawSession(url: string): Promise<RawSession> {
  const client = new Client({ connectionString: url });
  // A killed socket or a server-side FATAL surfaces as an 'error' event: never crash the worker.
  client.on('error', () => undefined);
  await client.connect();
  let closed = false;
  return {
    query: async <T extends QueryResultRow>(text: string, values?: unknown[]) =>
      (await client.query<T>(text, values)).rows,
    kill: () => {
      closed = true;
      client.connection.stream.destroy();
    },
    end: async () => {
      if (closed) return;
      closed = true;
      await client.end();
    },
  };
}
