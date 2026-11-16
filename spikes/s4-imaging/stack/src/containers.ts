// Starting, inspecting and removing the run's containers and networks (docker CLI). Every
// object carries the run label and its owner (host and process), so a teardown removes the run
// and a later suite removes only runs whose owner process is gone.
import { hostname } from 'node:os';
import { docker } from './docker.ts';

export const RUN_LABEL = 'shifa.s4.run';
export const OWNER_LABEL = 'shifa.s4.owner';
const OWNER = `${hostname()}:${String(process.pid)}`;
const labels = (runId: string) => [
  '--label',
  `${RUN_LABEL}=${runId}`,
  '--label',
  `${OWNER_LABEL}=${OWNER}`,
];

export interface NetworkAttachment {
  network: string;
  aliases?: string[];
}

export interface ContainerSpec {
  name: string;
  image: string;
  runId: string;
  networks: NetworkAttachment[];
  /** Non-secret environment, on the command line. */
  env?: Record<string, string>;
  /** Secret environment: passed by name, values only in the CLI's environment. */
  secretEnv?: Record<string, string>;
  /** Read-only bind mounts: host path → container path. */
  mounts?: [string, string][];
  tmpfs?: string[];
  /** Container ports published on 127.0.0.1 (random host port). */
  publish?: number[];
  capAdd?: string[];
  entrypoint?: string;
  command?: string[];
}

export async function runContainer(spec: ContainerSpec): Promise<string> {
  const args = ['run', '-d', '--name', spec.name, ...labels(spec.runId)];
  for (const { network, aliases = [] } of spec.networks) {
    args.push('--network', [`name=${network}`, ...aliases.map((a) => `alias=${a}`)].join(','));
  }
  for (const [key, value] of Object.entries(spec.env ?? {})) args.push('-e', `${key}=${value}`);
  for (const key of Object.keys(spec.secretEnv ?? {})) args.push('-e', key);
  for (const [source, target] of spec.mounts ?? []) {
    args.push('--mount', `type=bind,source=${source},target=${target},readonly`);
  }
  for (const path of spec.tmpfs ?? []) args.push('--tmpfs', path);
  for (const port of spec.publish ?? []) args.push('-p', `127.0.0.1::${String(port)}`);
  for (const cap of spec.capAdd ?? []) args.push('--cap-add', cap);
  if (spec.entrypoint !== undefined) args.push('--entrypoint', spec.entrypoint);
  args.push(spec.image, ...(spec.command ?? []));
  await docker(args, spec.secretEnv ? { env: spec.secretEnv } : {});
  return spec.name;
}

/** The host URL base (`http://127.0.0.1:<port>`) a published container port maps to. */
export async function hostPort(container: string, port: number): Promise<string> {
  const out = (await docker(['port', container, `${String(port)}/tcp`])).stdout;
  const match = /127\.0\.0\.1:(\d+)/.exec(out);
  if (!match?.[1]) throw new Error(`${container}:${String(port)} is not published`);
  return `127.0.0.1:${match[1]}`;
}

export async function createNetwork(
  name: string,
  runId: string,
  options: { internal: boolean },
): Promise<string> {
  const args = ['network', 'create', ...labels(runId)];
  if (options.internal) args.push('--internal');
  await docker([...args, name]);
  return name;
}

/** Whether the process that started a run is still alive (another host's runs count as alive). */
function ownerAlive(owner: string | undefined): boolean {
  const [host, pid] = (owner ?? '').split(/:(?=\d+$)/);
  if (!host || !pid) return false; // a run from before owner labels: leftover
  if (host !== hostname()) return true; // another machine's run on a shared engine: not ours
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

/**
 * Removes runs left behind by processes that are gone (a timed-out beforeAll, Ctrl-C,
 * S4_KEEP=1). Runs of live processes (another suite or worktree on this Docker host) stay.
 */
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

/** Removes every container and network of a run. */
export async function removeRun(runId: string): Promise<void> {
  const filter = `${RUN_LABEL}=${runId}`;
  const ids = (await docker(['ps', '-aq', '--filter', `label=${filter}`])).stdout.split(/\s+/);
  const containers = ids.filter(Boolean);
  if (containers.length > 0) await docker(['rm', '-f', '-v', ...containers], { check: false });
  const nets = (await docker(['network', 'ls', '-q', '--filter', `label=${filter}`])).stdout;
  const networks = nets.split(/\s+/).filter(Boolean);
  if (networks.length > 0) await docker(['network', 'rm', ...networks], { check: false });
}

export async function execIn(container: string, command: string[], input?: string) {
  return docker(['exec', ...(input === undefined ? [] : ['-i']), container, ...command], {
    check: false,
    ...(input === undefined ? {} : { input }),
  });
}
