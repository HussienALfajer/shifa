// PgBouncer in front of the harness PostgreSQL (0.3-S2a, spec 0.3-S2 criterion 1). Transaction
// mode with a server pool small enough that server connections are reused all the time. Config
// and userlist are built here per run and copied into the container: nothing is written to disk
// on the host, and nothing here is logged.
import {
  GenericContainer,
  type StartedNetwork,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';
import { type HarnessInfo, POOLER_STATS_USER } from './context.ts';
import type { ContainerAddress } from './guard.ts';
import { PGBOUNCER_IMAGE } from './image.ts';

/** Network alias of the PostgreSQL container; PgBouncer reaches it on its internal port. */
export const POSTGRES_ALIAS = 'shifa-postgres';
/** Clone with a server pool of exactly 1, so tests can force reuse of one server connection. */
export const POOLING_DATABASE = 'shifa_test_9994';

const LISTEN_PORT = 6432;
const CONFIG_DIR = '/etc/pgbouncer';
const INI = `${CONFIG_DIR}/pgbouncer.ini`;
const USERLIST = `${CONFIG_DIR}/userlist.txt`;

/** pgbouncer.ini for the harness. `server_reset_query` stays at its default, unused in transaction mode. */
export function pgbouncerIni(): string {
  const server = `host=${POSTGRES_ALIAS} port=5432`;
  return `[databases]
${POOLING_DATABASE} = ${server} dbname=${POOLING_DATABASE} pool_size=1
* = ${server}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = ${String(LISTEN_PORT)}
unix_socket_dir =
auth_type = scram-sha-256
auth_file = ${USERLIST}
stats_users = ${POOLER_STATS_USER}
max_client_conn = 1000
pool_mode = transaction
default_pool_size = 2
min_pool_size = 0
reserve_pool_size = 0
max_prepared_statements = 200
`;
}

/** `"user" "secret"` lines; every value is checked so none can break out of its quotes. */
export function pgbouncerUserlist(
  entries: readonly (readonly [user: string, secret: string])[],
): string {
  return entries
    .map(([user, secret]) => {
      if (!/^[a-z_]+$/.test(user) || /["\s]/.test(secret) || secret === '') {
        throw new Error('refusing a userlist entry with an unexpected user or secret');
      }
      return `"${user}" "${secret}"\n`;
    })
    .join('');
}

export interface StartedPooler {
  address: ContainerAddress;
  stop(): Promise<void>;
}

/** Starts PgBouncer on `network` once roles exist; the caller stores the address in `info.pooler`. */
export async function startPooler(
  network: StartedNetwork,
  info: HarnessInfo,
): Promise<StartedPooler> {
  // The random per-run passwords, not PostgreSQL's SCRAM secrets: applyRolesSql() re-sets the
  // passwords, which re-salts the stored secret, and a copied secret would then stop matching.
  // PgBouncer runs SCRAM with the client and, separately, with PostgreSQL. The owner is listed
  // only so that tests can prove createDb() refuses it behind the pooler.
  const userlist = pgbouncerUserlist([
    ['shifa_app', info.appPassword],
    ['shifa_owner', info.ownerPassword],
    [POOLER_STATS_USER, info.poolerStatsPassword],
  ]);
  const container: StartedTestContainer = await new GenericContainer(PGBOUNCER_IMAGE)
    .withNetwork(network)
    // Only the binary is used: no entrypoint script, no image-specific environment variables.
    .withEntrypoint(['pgbouncer'])
    .withCommand([INI])
    .withCopyContentToContainer([
      { content: pgbouncerIni(), target: INI, mode: 0o644 },
      // Readable by the image's unprivileged user; the container is throw-away and private.
      { content: userlist, target: USERLIST, mode: 0o644 },
    ])
    .withExposedPorts(LISTEN_PORT)
    .withWaitStrategy(Wait.forLogMessage(/process up/))
    .start();
  return {
    address: { host: container.getHost(), port: container.getMappedPort(LISTEN_PORT) },
    stop: async () => {
      await container.stop();
    },
  };
}
