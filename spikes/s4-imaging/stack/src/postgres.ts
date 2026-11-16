// One PostgreSQL 18 server for the run (criterion 5): a database and role per tenant Orthanc,
// plus the gateway's spike database. No database is reachable by another role.
import { readFile } from 'node:fs/promises';
import { execIn, runContainer } from './containers.ts';
import { waitFor } from './docker.ts';
import { IMAGES } from './images.ts';

export interface DatabaseRole {
  name: string;
  password: string;
}

const psql = async (container: string, database: string, sql: string) => {
  const result = await execIn(
    container,
    ['psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-q'],
    sql,
  );
  if (result.code !== 0) throw new Error(`psql on ${database}: ${result.stderr.slice(0, 300)}`);
};

export async function startPostgres(options: {
  name: string;
  runId: string;
  network: string;
  superPassword: string;
  roles: DatabaseRole[];
}): Promise<string> {
  const container = await runContainer({
    name: options.name,
    runId: options.runId,
    image: IMAGES.postgres,
    networks: [{ network: options.network, aliases: ['postgres'] }],
    secretEnv: { POSTGRES_PASSWORD: options.superPassword },
    tmpfs: ['/var/lib/postgresql'],
    command: ['postgres', '-c', 'max_connections=200'],
  });
  // pg_isready over TCP: the entrypoint's temporary server listens on the socket only.
  await waitFor(
    'postgres',
    async () =>
      (await execIn(container, ['pg_isready', '-h', '127.0.0.1', '-U', 'postgres'])).code === 0,
    120_000,
  );
  // Role and database names are fixed identifiers; passwords are hex.
  const statements = options.roles.flatMap((role) => [
    `create role ${role.name} login password '${role.password}';`,
    `create database ${role.name} owner ${role.name};`,
    `revoke all on database ${role.name} from public;`,
  ]);
  await psql(container, 'postgres', statements.join('\n'));
  const schema = await readFile(new URL('../../gateway/sql/schema.sql', import.meta.url), 'utf8');
  await psql(container, 's4_gateway', schema);
  return container;
}
