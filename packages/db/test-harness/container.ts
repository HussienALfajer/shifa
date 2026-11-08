// @shifa/db/harness: the throw-away PostgreSQL container with roles applied and migrations in
// `shifa_template`. Used by Vitest's globalSetup and by scripts outside Vitest (the API boot
// check). No vitest import here, so it runs under plain Node (type stripping).
import { randomBytes } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from '../src/migrate.ts';
import { applyRoles, type HarnessInfo, type HarnessRole, urlFor, withPool } from './context.ts';
import { explainStartFailure } from './docker.ts';
import { POSTGRES_IMAGE, RYUK_IMAGE } from './image.ts';

export { acquireDbTestLock } from './guard.ts';
export type { HarnessInfo, HarnessRole };

/** The migrated database every harness user starts from. */
export const TEMPLATE_DATABASE = 'shifa_template';

const secret = () => randomBytes(16).toString('hex');

async function startContainer(superuserPassword: string): Promise<StartedPostgreSqlContainer> {
  process.env['RYUK_CONTAINER_IMAGE'] ??= RYUK_IMAGE;
  try {
    return await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withUsername('postgres')
      .withPassword(superuserPassword)
      .withDatabase('postgres')
      // Throw-away data: skip durability for speed.
      .withTmpFs({ '/var/lib/postgresql': 'rw' })
      .withCommand(['postgres', '-c', 'fsync=off', '-c', 'synchronous_commit=off'])
      .start();
  } catch (err) {
    throw explainStartFailure(err);
  }
}

export interface HarnessContainer {
  info: HarnessInfo;
  /** Guarded URL of a harness role (throws for anything outside this container). */
  url(role: HarnessRole, database?: string): string;
  stop(): Promise<void>;
}

/**
 * Starts the pinned PostgreSQL image, applies roles.sql and test logins (random passwords),
 * creates `shifa_template` and migrates it as the owner. The caller holds the DB test lock.
 */
export async function startHarnessContainer(): Promise<HarnessContainer> {
  const superuserPassword = secret();
  const container = await startContainer(superuserPassword);
  try {
    const info: HarnessInfo = {
      host: container.getHost(),
      port: container.getPort(),
      superuserPassword,
      ownerPassword: secret(),
      appPassword: secret(),
    };
    await applyRoles(info);
    await withPool(urlFor(info, 'superuser', 'postgres'), (pool) =>
      pool.query(`CREATE DATABASE ${TEMPLATE_DATABASE} OWNER shifa_owner`),
    );
    await migrate(urlFor(info, 'owner', TEMPLATE_DATABASE));
    return {
      info,
      url: (role, database = TEMPLATE_DATABASE) => urlFor(info, role, database),
      stop: async () => {
        await container.stop();
      },
    };
  } catch (err) {
    await container.stop().catch(() => undefined);
    throw err;
  }
}
