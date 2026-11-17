// PostgreSQL 18 for the messaging suites: one container per test file, published on 127.0.0.1
// only, one fresh database per test. Spike state is never in packages/db/migrations.
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { hostPort, removeRun, runContainer } from './containers.ts';
import { waitFor } from './docker.ts';
import { IMAGES } from './images.ts';

export interface MessagingDb {
  /** Creates an empty database and returns its URL. */
  createDatabase(name: string): Promise<string>;
  stop(): Promise<void>;
}

export async function startMessagingDb(): Promise<MessagingDb> {
  const runId = `s5db-${randomBytes(4).toString('hex')}`;
  const password = randomBytes(18).toString('base64url');
  const container = `${runId}-pg`;
  try {
    await runContainer({
      name: container,
      image: IMAGES.postgres,
      runId,
      networks: [{ network: 'bridge' }],
      secretEnv: { POSTGRES_PASSWORD: password },
      publish: [5432],
      command: ['-c', 'max_connections=300'],
    });
    const host = await hostPort(container, 5432);
    const url = (db: string) => `postgres://postgres:${password}@${host}/${db}`;
    await waitFor('messaging PostgreSQL', async () => {
      const client = new pg.Client({ connectionString: url('postgres') });
      await client.connect();
      await client.query('select 1');
      await client.end();
      return true;
    });
    return {
      async createDatabase(name) {
        if (!/^[a-z0-9_]+$/.test(name)) throw new Error('database name');
        const client = new pg.Client({ connectionString: url('postgres') });
        await client.connect();
        try {
          await client.query(`create database ${name}`);
        } finally {
          await client.end();
        }
        return url(name);
      },
      async stop() {
        if (process.env['S5_KEEP'] !== '1') await removeRun(runId);
      },
    };
  } catch (error) {
    await removeRun(runId);
    throw error;
  }
}
