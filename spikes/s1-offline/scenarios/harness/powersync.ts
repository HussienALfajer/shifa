// PowerSync service for the scenario stack (engine a). Spike container only: the replication role
// `s1_powersync` (REPLICATION + BYPASSRLS, SELECT on s1) exists only here, never in roles.sql or
// migrations. Bucket storage is PostgreSQL (`s1_powersync_storage`), no MongoDB.
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { AUDIENCE } from '@shifa-spike/s1-server';
import {
  GenericContainer,
  type StartedNetwork,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';
import { IMAGES } from './images.ts';
import type { PgUrls } from './stack.ts';

const SYNC_CONFIG = new URL('../powersync/sync-config.yaml', import.meta.url);
const SQL = new URL('../powersync/powersync.sql', import.meta.url);
export const POWERSYNC_VERSION = '1.28.3';

/** Runs powersync.sql: role, grants, storage database (superuser) and publication (owner). */
export async function preparePowerSync(
  urls: PgUrls,
  run: (url: string, sql: string) => Promise<void>,
): Promise<string> {
  const password = randomBytes(18).toString('base64url');
  const [roleSql, publicationSql] = (await readFile(SQL, 'utf8')).split('-- @owner');
  await run(urls.superuserPostgres, (roleSql ?? '').replace(':password', `'${password}'`));
  await run(urls.superuserPostgres, 'CREATE DATABASE s1_powersync_storage OWNER s1_powersync');
  await run(
    urls.superuser,
    'GRANT USAGE ON SCHEMA s1 TO s1_powersync; GRANT SELECT ON ALL TABLES IN SCHEMA s1 TO s1_powersync',
  );
  await run(urls.owner, publicationSql ?? '');
  return password;
}

export async function startPowerSync(
  network: StartedNetwork,
  password: string,
  jwks: { keys: unknown[] },
): Promise<StartedTestContainer> {
  const pg = (db: string) => `postgresql://s1_powersync:${password}@pg:5432/${db}`;
  const config = {
    replication: { connections: [{ type: 'postgresql', uri: pg('shifa'), sslmode: 'disable' }] },
    storage: { type: 'postgresql', uri: pg('s1_powersync_storage'), sslmode: 'disable' },
    port: 8080,
    sync_config: { content: await readFile(SYNC_CONFIG, 'utf8'), exit_on_error: true },
    client_auth: { jwks, audience: [AUDIENCE] },
    telemetry: { disable_telemetry_sharing: true },
  };
  return new GenericContainer(IMAGES.powersync)
    .withNetwork(network)
    .withNetworkAliases('powersync')
    .withEnvironment({
      POWERSYNC_CONFIG_B64: Buffer.from(JSON.stringify(config)).toString('base64'),
    })
    .withExposedPorts(8080)
    .withWaitStrategy(Wait.forHttp('/probes/liveness', 8080).withStartupTimeout(120_000))
    .start();
}
