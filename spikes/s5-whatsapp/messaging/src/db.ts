// Spike state access with plain `pg` (slice 0.3-S5a, "Spike state": its own database, outside
// the product schema and withTenant() by design). Timestamps come back as ISO strings.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

// Process-wide (the service is the only user of pg here): timestamptz → ISO string with ms.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value: string) =>
  new Date(value).toISOString(),
);

export type Client = pg.PoolClient;

export class Db {
  readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 10 });
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async tx<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const value = await fn(client);
      await client.query('commit');
      return value;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Applies the schema once even when several processes start together. */
  async migrate(): Promise<void> {
    const sql = readFileSync(join(import.meta.dirname, '..', 'sql', 'schema.sql'), 'utf8');
    const client = await this.pool.connect();
    try {
      await client.query('select pg_advisory_lock(5005)');
      await client.query(sql);
    } finally {
      await client.query('select pg_advisory_unlock(5005)').catch(() => undefined);
      client.release();
    }
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}

export async function rows<T>(client: Client, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await client.query(sql, params)).rows as T[];
}
