// Starting, inspecting and removing the run's containers and networks (docker CLI). Every
// object carries the run label, so a teardown, or the next run after a crash, removes it all.
import { docker } from './docker.ts';

export const RUN_LABEL = 'shifa.s4.run';

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
  const args = ['run', '-d', '--name', spec.name, '--label', `${RUN_LABEL}=${spec.runId}`];
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
  const args = ['network', 'create', '--label', `${RUN_LABEL}=${runId}`];
  if (options.internal) args.push('--internal');
  await docker([...args, name]);
  return name;
}

/** Removes every container and network of a run (pass '*' for every run). */
export async function removeRun(runId: string): Promise<void> {
  const filter = runId === '*' ? RUN_LABEL : `${RUN_LABEL}=${runId}`;
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
