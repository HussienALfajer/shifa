// The scenario stack: its own PostgreSQL 18 (wal_level=logical for PowerSync), the spike server
// in-process (one with a normal token TTL, one with a short TTL for the expiry spec), the
// PowerSync service for ENGINE=powersync, and Toxiproxy with one proxy per device (two with
// PowerSync) between the browser and the services.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { createDb, migrate, ROLES_SQL, type ShifaDb } from '@shifa/db';
import {
  buildServer,
  newSigningKeys,
  SCHEMA_SQL,
  type SigningKeys,
  syntheticIdentities,
} from '@shifa-spike/s1-server';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ToxiProxyContainer } from '@testcontainers/toxiproxy';
import type { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import {
  Network,
  type StartedNetwork,
  type StartedTestContainer,
  TestContainers,
} from 'testcontainers';
import { IMAGES } from './images.ts';
import { preparePowerSync, startPowerSync } from './powersync.ts';

export type Engine = 'outbox' | 'powersync' | 'stub-drop' | 'stub-dup';
/** Devices behind the normal server, and one behind the short-TTL server. */
export const DEVICES = ['dev-a', 'dev-b', 'dev-r'] as const;
export const EXPIRY_DEVICE = 'dev-x';
export const SHORT_TTL_SECONDS = 20;

const secret = () => randomBytes(18).toString('base64url');
const WEB = fileURLToPath(new URL('../../web/', import.meta.url));

export interface Stack {
  env: Record<string, string>;
  pg: StartedPostgreSqlContainer;
  superuserUrl: string;
  stop(): Promise<void>;
}

async function run(url: string, sql: string): Promise<void> {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

export function buildPrototype(engine: Engine): string {
  const outDir = `dist-${engine}`;
  execFileSync(
    process.execPath,
    [`${WEB}node_modules/vite/bin/vite.js`, 'build', '--outDir', outDir],
    {
      cwd: WEB,
      env: { ...process.env, VITE_ENGINE: engine },
      stdio: 'inherit',
    },
  );
  return `${WEB}${outDir}`;
}

export interface PgUrls {
  superuser: string;
  superuserPostgres: string;
  owner: string;
  app: string;
}

export async function startPostgres(
  network?: StartedNetwork,
): Promise<{ pg: StartedPostgreSqlContainer; urls: PgUrls }> {
  const passwords = { superuser: secret(), owner: secret(), app: secret() };
  let container = new PostgreSqlContainer(IMAGES.postgres);
  if (network) container = container.withNetwork(network).withNetworkAliases('pg');
  const pg = await container
    .withUsername('postgres')
    .withPassword(passwords.superuser)
    .withDatabase('postgres')
    .withCommand([
      'postgres',
      '-c',
      'wal_level=logical',
      '-c',
      'max_replication_slots=10',
      '-c',
      'max_wal_senders=10',
    ])
    .start();
  const base = `${pg.getHost()}:${String(pg.getPort())}`;
  const urls = {
    superuser: `postgres://postgres:${passwords.superuser}@${base}/shifa`,
    superuserPostgres: `postgres://postgres:${passwords.superuser}@${base}/postgres`,
    owner: `postgres://shifa_owner:${passwords.owner}@${base}/shifa`,
    app: `postgres://shifa_app:${passwords.app}@${base}/shifa`,
  };
  await run(urls.superuserPostgres, await readFile(ROLES_SQL, 'utf8'));
  // Test-only logins for the two roles; the container dies with the run.
  await run(
    urls.superuserPostgres,
    `ALTER ROLE shifa_owner LOGIN PASSWORD '${passwords.owner}';
     ALTER ROLE shifa_app PASSWORD '${passwords.app}';`,
  );
  await run(urls.superuserPostgres, 'CREATE DATABASE shifa OWNER shifa_owner');
  await migrate(urls.owner);
  await run(urls.owner, await readFile(SCHEMA_SQL, 'utf8'));
  return { pg, urls };
}

async function listen(
  db: ShifaDb,
  ttl: number,
  staticDir: string,
  keys: SigningKeys,
): Promise<FastifyInstance> {
  const app = await buildServer({
    db,
    identities: syntheticIdentities(),
    tokenTtlSeconds: ttl,
    log: () => undefined,
    staticDir,
    keys,
  });
  await app.listen({ port: 0, host: '0.0.0.0' });
  return app;
}

const envKey = (prefix: string, device: string) =>
  `${prefix}_${device.replace('-', '_').toUpperCase()}`;

export async function startStack(engine: Engine): Promise<Stack> {
  const staticDir = buildPrototype(engine);
  const network = await new Network().start();
  const { pg, urls } = await startPostgres(network);
  const db = createDb(urls.app);
  // One key pair for both servers, so PowerSync trusts tokens from either.
  const keys = await newSigningKeys();
  const normal = await listen(db, 3_600, staticDir, keys);
  const short = await listen(db, SHORT_TTL_SECONDS, staticDir, keys);
  const port = (app: FastifyInstance) => (app.server.address() as AddressInfo).port;
  await TestContainers.exposeHostPorts(port(normal), port(short));

  let powersync: StartedTestContainer | undefined;
  if (engine === 'powersync') {
    const password = await preparePowerSync(urls, run);
    const jwks = (await (
      await fetch(`http://127.0.0.1:${String(port(normal))}/.well-known/jwks.json`)
    ).json()) as {
      keys: unknown[];
    };
    powersync = await startPowerSync(network, password, jwks);
  }

  const toxi = await new ToxiProxyContainer(IMAGES.toxiproxy).withNetwork(network).start();
  const env: Record<string, string> = {
    S1_ENGINE: engine,
    S1_SERVER_URL: `http://127.0.0.1:${String(port(normal))}`,
    S1_TOXI_API: `http://${toxi.getHost()}:${String(toxi.getMappedPort(8474))}`,
  };
  if (powersync)
    env['S1_POWERSYNC_URL'] =
      `http://${powersync.getHost()}:${String(powersync.getMappedPort(8080))}`;
  for (const device of [...DEVICES, EXPIRY_DEVICE]) {
    const upstream = device === EXPIRY_DEVICE ? port(short) : port(normal);
    const proxy = await toxi.createProxy({
      name: device,
      upstream: `host.testcontainers.internal:${String(upstream)}`,
    });
    env[envKey('S1_URL', device)] = `http://${proxy.host}:${String(proxy.port)}`;
    if (powersync) {
      // A second proxy per device for the sync stream: a cut takes both links down.
      const ps = await toxi.createProxy({ name: `${device}-ps`, upstream: 'powersync:8080' });
      env[envKey('S1_PS_URL', device)] = `http://${ps.host}:${String(ps.port)}`;
    }
  }
  return {
    env,
    pg,
    superuserUrl: urls.superuser,
    async stop() {
      await normal.close();
      await short.close();
      await db.close();
      await toxi.stop();
      await powersync?.stop();
      await pg.stop();
      await network.stop();
    },
  };
}
