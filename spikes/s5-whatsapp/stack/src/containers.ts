// Starting, inspecting and removing the run's containers and networks. Every object carries the
// run label and its owner (host and process), so a teardown removes the run and a later suite
// removes only runs whose owner process is gone.
import { hostname } from 'node:os';
import { docker } from './docker.ts';

export const RUN_LABEL = 'shifa.s5.run';
export const OWNER_LABEL = 'shifa.s5.owner';
const OWNER = `${hostname()}:${String(process.pid)}`;
const labels = (runId: string) => [
  '--label',
  `${RUN_LABEL}=${runId}`,
  '--label',
  `${OWNER_LABEL}=${OWNER}`,
];

export interface ContainerSpec {
  name: string;
  image: string;
  runId: string;
  /** Every network is attached at start (docker run takes several --network since Engine 25). */
  networks: { network: string; aliases?: string[] }[];
  env?: Record<string, string>;
  /** Passed by name; values only in the CLI's environment. */
  secretEnv?: Record<string, string>;
  /** Container ports published on 127.0.0.1 (random host port). */
  publish?: number[];
  command?: string[];
}

export async function runContainer(spec: ContainerSpec): Promise<string> {
  const args = ['run', '-d', '--name', spec.name, ...labels(spec.runId)];
  for (const { network, aliases = [] } of spec.networks) {
    args.push('--network', [`name=${network}`, ...aliases.map((a) => `alias=${a}`)].join(','));
  }
  for (const [key, value] of Object.entries(spec.env ?? {})) args.push('-e', `${key}=${value}`);
  for (const key of Object.keys(spec.secretEnv ?? {})) args.push('-e', key);
  for (const port of spec.publish ?? []) args.push('-p', `127.0.0.1::${String(port)}`);
  args.push(spec.image, ...(spec.command ?? []));
  await docker(args, spec.secretEnv ? { env: spec.secretEnv } : {});
  return spec.name;
}

export async function createNetwork(name: string, runId: string, internal: boolean) {
  await docker(['network', 'create', ...labels(runId), ...(internal ? ['--internal'] : []), name]);
  return name;
}

/** `127.0.0.1:<port>` that a published container port maps to. */
export async function hostPort(container: string, port: number): Promise<string> {
  const out = (await docker(['port', container, `${String(port)}/tcp`])).stdout;
  const match = /127\.0\.0\.1:(\d+)/.exec(out);
  if (!match?.[1]) throw new Error(`${container}:${String(port)} is not published`);
  return `127.0.0.1:${match[1]}`;
}

/** Host bindings of every port of a container (empty when nothing is published). */
export async function inspectPorts(container: string): Promise<string[]> {
  const out = await docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]);
  const ports = JSON.parse(out.stdout) as Record<string, { HostPort: string }[] | null> | null;
  return Object.entries(ports ?? {}).flatMap(([port, bindings]) =>
    (bindings ?? []).map((b) => `${port}->${b.HostPort}`),
  );
}

type WahaEnvName =
  | 'WHATSAPP_DEFAULT_ENGINE'
  | 'WAHA_PRINT_QR'
  | 'WAHA_DASHBOARD_ENABLED'
  | 'WHATSAPP_SWAGGER_ENABLED'
  | 'WAHA_LOG_LEVEL'
  | 'WAHA_LOG_FORMAT';
export type ContainerEnv = Record<string, string> & Partial<Record<WahaEnvName, string>>;

/** The container's environment as configured. */
export async function inspectEnv(container: string): Promise<ContainerEnv> {
  const out = await docker(['inspect', '--format', '{{json .Config.Env}}', container]);
  const entries = (JSON.parse(out.stdout) as string[]).map((line) => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1)] as const;
  });
  return Object.fromEntries(entries);
}

export async function execIn(container: string, command: string[]) {
  return docker(['exec', container, ...command], { check: false });
}

/** Whether the process that started a run is still alive (another host's runs count as alive). */
function ownerAlive(owner: string | undefined): boolean {
  const [host, pid] = (owner ?? '').split(/:(?=\d+$)/);
  if (!host || !pid) return false;
  if (host !== hostname()) return true;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export async function removeStaleRuns(): Promise<void> {
  const format = `{{.Label "${RUN_LABEL}"}} {{.Label "${OWNER_LABEL}"}}`;
  const rows = [
    ...(
      await docker(['ps', '-a', '--filter', `label=${RUN_LABEL}`, '--format', format])
    ).stdout.split('\n'),
    ...(
      await docker(['network', 'ls', '--filter', `label=${RUN_LABEL}`, '--format', format])
    ).stdout.split('\n'),
  ];
  const owners = new Map<string, string | undefined>();
  for (const row of rows.filter(Boolean)) {
    const [runId, owner] = row.trim().split(' ');
    if (runId) owners.set(runId, owner === '' ? undefined : owner);
  }
  for (const [runId, owner] of owners) {
    if (!ownerAlive(owner)) await removeRun(runId);
  }
}

export async function removeRun(runId: string): Promise<void> {
  const filter = `${RUN_LABEL}=${runId}`;
  const ids = (await docker(['ps', '-aq', '--filter', `label=${filter}`])).stdout.split(/\s+/);
  const containers = ids.filter(Boolean);
  if (containers.length > 0) await docker(['rm', '-f', '-v', ...containers], { check: false });
  const nets = (await docker(['network', 'ls', '-q', '--filter', `label=${filter}`])).stdout;
  const networks = nets.split(/\s+/).filter(Boolean);
  if (networks.length > 0) await docker(['network', 'rm', ...networks], { check: false });
}
