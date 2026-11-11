// @shifa/db/harness: the throw-away PostgreSQL container with roles applied and migrations in
// `shifa_template`, and PgBouncer in front of it on a private network (0.3-S2a). Used by
// Vitest's globalSetup and by scripts outside Vitest (the API boot check). No vitest import
// here, so it runs under plain Node (type stripping).
import { randomBytes } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Network, type StartedNetwork } from 'testcontainers';
import { migrate } from '../src/migrate.ts';
import {
  applyRoles,
  type HarnessInfo,
  type HarnessRole,
  urlFor,
  type Via,
  withPool,
} from './context.ts';
import { explainStartFailure } from './docker.ts';
import { POSTGRES_IMAGE, RYUK_IMAGE } from './image.ts';
import { POSTGRES_ALIAS, startPooler } from './pgbouncer.ts';

export { acquireDbTestLock } from './guard.ts';
export type { HarnessInfo, HarnessRole, Via };

/** The migrated database every harness user starts from. */
export const TEMPLATE_DATABASE = 'shifa_template';

const secret = () => randomBytes(16).toString('hex');

async function startContainer(
  network: StartedNetwork,
  superuserPassword: string,
): Promise<StartedPostgreSqlContainer> {
  try {
    return await new PostgreSqlContainer(POSTGRES_IMAGE)
      .withNetwork(network)
      .withNetworkAliases(POSTGRES_ALIAS)
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
  /** Guarded URL of a harness role (throws for anything outside these containers). */
  url(role: HarnessRole, database?: string, options?: { via?: Via }): string;
  stop(): Promise<void>;
}

/**
 * Starts the pinned PostgreSQL image, applies roles.sql and test logins (random passwords),
 * creates `shifa_template` and migrates it as the owner, then starts PgBouncer in front of it.
 * The caller holds the DB test lock.
 */
export async function startHarnessContainer(): Promise<HarnessContainer> {
  process.env['RYUK_CONTAINER_IMAGE'] ??= RYUK_IMAGE;
  const network = await new Network().start().catch((err: unknown) => {
    throw explainStartFailure(err);
  });
  // Stopped in reverse order: PgBouncer, PostgreSQL, then the network.
  const stops: (() => Promise<unknown>)[] = [() => network.stop()];
  const stopAll = async () => {
    for (const stop of stops.splice(0).reverse()) await stop().catch(() => undefined);
  };
  try {
    const superuserPassword = secret();
    const container = await startContainer(network, superuserPassword);
    stops.push(() => container.stop());
    const info: HarnessInfo = {
      host: container.getHost(),
      port: container.getPort(),
      superuserPassword,
      ownerPassword: secret(),
      appPassword: secret(),
      poolerAdminPassword: secret(),
    };
    await applyRoles(info);
    await withPool(urlFor(info, 'superuser', 'postgres'), (pool) =>
      pool.query(`CREATE DATABASE ${TEMPLATE_DATABASE} OWNER shifa_owner`),
    );
    await migrate(urlFor(info, 'owner', TEMPLATE_DATABASE));
    const pooler = await startPooler(network, info);
    stops.push(() => pooler.stop());
    info.pooler = pooler.address;
    return {
      info,
      url: (role, database = TEMPLATE_DATABASE, options) => urlFor(info, role, database, options),
      stop: stopAll,
    };
  } catch (err) {
    await stopAll();
    throw err;
  }
}
