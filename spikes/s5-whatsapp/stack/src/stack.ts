// The pinned WAHA stack: networks `messaging` (internal: no route out, so WhatsApp cannot be
// reached from here, OD-45) and `edge`; one PostgreSQL 18 for WAHA's own databases and another
// for the spike's state (`s5_messaging`), so WAHA's CREATEDB role never reaches spike state;
// one WAHA container per name. WAHA has no published port; tests reach it with a one-shot
// probe container on a chosen network.
import { randomBytes } from 'node:crypto';
import { createNetwork, removeRun, runContainer } from './containers.ts';
import { docker, waitFor } from './docker.ts';
import { IMAGES } from './images.ts';
import { newWahaHandle, secret, type WahaHandle, wahaSpec } from './waha.ts';

export type WahaName = 'platform' | 'clinics';

export interface StackOptions {
  /** WAHA containers to start (MSG-09: the platform session runs in its own container). */
  waha: WahaName[];
  /** Where WAHA posts webhooks (the spike service's alias on `messaging`). */
  webhookBase?: string;
}

export interface ProbeOptions {
  apiKey?: string;
  method?: string;
  json?: unknown;
}

export interface ProbeResult {
  /** 0 when the URL could not be reached at all. */
  status: number;
  body: string;
}

export interface Stack {
  runId: string;
  networks: { messaging: string; edge: string };
  /** Only the started names are present. */
  waha: Record<WahaName, WahaHandle>;
  /** HTTP request from a throwaway container on `messaging` or `edge`. */
  probe(network: 'messaging' | 'edge', url: string, options: ProbeOptions): Promise<ProbeResult>;
  /** Rows (as string arrays) of a query run as superuser on WAHA's PostgreSQL. */
  wahaDb(sql: string): Promise<string[][]>;
  /** Tries to open the spike database as the given role, from WAHA's database host. */
  connectAs(database: 'messaging', role: string, password: string): Promise<{ ok: boolean }>;
  logs(container: string): Promise<string>;
  stop(): Promise<void>;
}

const PROBE = `
const [url, method, body] = process.argv.slice(1);
const headers = { 'content-type': 'application/json' };
if (process.env.PROBE_KEY) headers['x-api-key'] = process.env.PROBE_KEY;
fetch(url, { method, headers, body: body || undefined, signal: AbortSignal.timeout(5000) })
  .then(async (r) => console.log(JSON.stringify({ status: r.status, body: await r.text() })))
  .catch(() => console.log(JSON.stringify({ status: 0, body: '' })));
`;

async function startPostgres(runId: string, name: string, network: string, password: string) {
  const container = `${runId}-${name}`;
  await runContainer({
    name: container,
    image: IMAGES.postgres,
    runId,
    networks: [{ network, aliases: [name] }],
    secretEnv: { POSTGRES_PASSWORD: password },
  });
  await waitFor(`${name} ready`, async () => {
    const r = await docker(['exec', container, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1'], {
      check: false,
    });
    return r.code === 0;
  });
  return container;
}

const psql = (container: string, sql: string) =>
  docker(
    ['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '\t'],
    {
      input: sql,
    },
  );

export async function startStack(options: StackOptions): Promise<Stack> {
  const runId = `s5-${randomBytes(4).toString('hex')}`;
  const webhookBase = options.webhookBase ?? 'http://messaging:8080';
  try {
    const messaging = await createNetwork(`${runId}-messaging`, runId, true);
    const edge = await createNetwork(`${runId}-edge`, runId, false);
    const wahaPg = await startPostgres(runId, 'pg-waha', messaging, secret());
    const spikePg = await startPostgres(runId, 'pg-messaging', messaging, secret());
    await psql(spikePg, 'create database s5_messaging;');

    const waha = {} as Record<WahaName, WahaHandle>;
    for (const name of options.waha) {
      const handle = newWahaHandle(runId, name);
      // Role names and passwords are generated here (base64url), safe inside quotes.
      await psql(
        wahaPg,
        `create role ${handle.dbRole} login createdb password '${handle.dbPassword}';`,
      );
      await runContainer(wahaSpec(runId, handle, messaging, 'pg-waha', webhookBase));
      waha[name] = handle;
    }

    const probe: Stack['probe'] = async (network, url, opts) => {
      const net = network === 'messaging' ? messaging : edge;
      const args = [
        'run',
        '--rm',
        '--network',
        net,
        '-e',
        'PROBE_KEY',
        IMAGES.node,
        'node',
        '-e',
        PROBE,
      ];
      args.push(
        url,
        opts.method ?? 'GET',
        opts.json === undefined ? '' : JSON.stringify(opts.json),
      );
      const out = await docker(args, { env: { PROBE_KEY: opts.apiKey ?? '' } });
      const line = out.stdout.trim().split('\n').at(-1) ?? '';
      return JSON.parse(line) as ProbeResult;
    };
    for (const handle of Object.values(waha)) {
      await waitFor(`${handle.container} ping`, async () => {
        return (await probe('messaging', `${handle.url}/ping`, {})).status === 200;
      });
    }

    return {
      runId,
      networks: { messaging, edge },
      waha,
      probe,
      async wahaDb(sql) {
        const out = await psql(wahaPg, sql);
        return out.stdout
          .split('\n')
          .filter(Boolean)
          .map((line) => line.split('\t'));
      },
      async connectAs(_database, role, password) {
        const r = await docker(
          [
            'exec',
            '-e',
            'PGPASSWORD',
            wahaPg,
            'psql',
            '-h',
            'pg-messaging',
            '-U',
            role,
            '-d',
            's5_messaging',
            '-c',
            'select 1',
          ],
          { check: false, env: { PGPASSWORD: password } },
        );
        return { ok: r.code === 0 };
      },
      async logs(container) {
        const r = await docker(['logs', container]);
        return `${r.stdout}\n${r.stderr}`;
      },
      async stop() {
        if (process.env['S5_KEEP'] !== '1') await removeRun(runId);
      },
    };
  } catch (error) {
    if (process.env['S5_KEEP'] !== '1') await removeRun(runId);
    throw error;
  }
}
