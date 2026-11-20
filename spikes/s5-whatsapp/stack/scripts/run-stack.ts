// The owner's manual-day stack (0.3-S5c, criterion 11, OD-45): unlike the test stack it reaches
// real WhatsApp, so it runs on a normal (non-internal) network. It is labelled apart from the
// suites' runs (`shifa.s5.manual`), so `removeStaleRuns()` in a test never removes it.
//
//   node scripts/run-stack.ts up               start PostgreSQL x2 and WAHA platform + clinics,
//                                              write spikes/s5-whatsapp/.env.local (numbers stay
//                                              for the owner to fill)
//   node scripts/run-stack.ts status           containers and `docker stats` (criterion 12)
//   node scripts/run-stack.ts restart <name>   restarts one WAHA container and times its sessions
//                                              back to WORKING (checklist step 12)
//   node scripts/run-stack.ts grep-logs        counts (never prints) the owner's numbers and the
//                                              run's codes in both WAHA logs (step 15)
//   node scripts/run-stack.ts down             removes everything (WAHA's linked sessions too)
//
// Ports are published on 127.0.0.1 only. WAHA posts webhooks to host.docker.internal, which
// Docker Desktop forwards to the host's loopback, so the service keeps listening on 127.0.0.1.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { docker, waitFor } from '../src/docker.ts';
import { IMAGES } from '../src/images.ts';
import { newWahaHandle, secret, wahaSpec } from '../src/waha.ts';

const LABEL = 'shifa.s5.manual';
const PREFIX = 's5-manual';
const NETWORK = `${PREFIX}-net`;
const SPIKE_DIR = join(import.meta.dirname, '..', '..');
const ENV_FILE = join(SPIKE_DIR, '.env.local');
/** Codes recorded by `messaging/scripts/device.ts` for the log check; git-ignored, deleted here. */
const CODES_FILE = join(SPIKE_DIR, '..', '..', '.cache', 's5', 'run-codes.txt');
const NAMES = ['platform', 'clinics'] as const;
const HOST_PORTS = { platform: 3110, clinics: 3111, pg: 3112 } as const;
const SESSIONS: Record<(typeof NAMES)[number], string> = {
  platform: 'platform',
  clinics: 'clinic-g',
};

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m?.[1] && m[2]) env[m[1]] = m[2];
  }
  return env;
}

async function running(): Promise<string[]> {
  const r = await docker(['ps', '-a', '--filter', `label=${LABEL}`, '--format', '{{.Names}}']);
  return r.stdout.split(/\s+/).filter(Boolean);
}

async function run(
  name: string,
  image: string,
  options: {
    aliases?: string[];
    env?: Record<string, string>;
    secretEnv?: Record<string, string>;
    /** `hostPort:containerPort`, bound to 127.0.0.1. */
    publish?: string;
    command?: string[];
  },
) {
  const args = ['run', '-d', '--name', name, '--label', `${LABEL}=1`, '--restart', 'no'];
  args.push(
    '--network',
    [`name=${NETWORK}`, ...(options.aliases ?? []).map((a) => `alias=${a}`)].join(','),
  );
  args.push('--add-host', 'host.docker.internal:host-gateway');
  for (const [k, v] of Object.entries(options.env ?? {})) args.push('-e', `${k}=${v}`);
  for (const k of Object.keys(options.secretEnv ?? {})) args.push('-e', k);
  // Fixed host ports: a random one changes on every `docker start`/`restart`, and the running
  // service keeps the old URL (found on the manual day, 2026-11-19).
  if (options.publish) args.push('-p', `127.0.0.1:${options.publish}`);
  args.push(image, ...(options.command ?? []));
  await docker(args, options.secretEnv ? { env: options.secretEnv } : {});
}

async function hostPort(container: string, port: number): Promise<string> {
  const r = await docker(['port', container, `${String(port)}/tcp`]);
  const m = /127\.0\.0\.1:(\d+)/.exec(r.stdout);
  if (!m?.[1]) throw new Error(`${container}:${String(port)} is not published`);
  return m[1];
}

const psql = (container: string, sql: string) =>
  docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], {
    input: sql,
  });

async function startPostgres(alias: string, password: string, publish: boolean) {
  const container = `${PREFIX}-${alias}`;
  await run(container, IMAGES.postgres, {
    aliases: [alias],
    secretEnv: { POSTGRES_PASSWORD: password },
    ...(publish ? { publish: `${String(HOST_PORTS.pg)}:5432` } : {}),
  });
  await waitFor(`${alias} ready`, async () => {
    const r = await docker(['exec', container, 'pg_isready', '-U', 'postgres', '-h', '127.0.0.1'], {
      check: false,
    });
    return r.code === 0;
  });
  return container;
}

async function up() {
  if ((await running()).length > 0) {
    throw new Error('the manual stack is already up (`status` shows it; `down` removes it)');
  }
  const listenPort = readEnv()['S5_LISTEN_PORT'] ?? '3105';
  await docker(['network', 'create', '--label', `${LABEL}=1`, NETWORK]);
  const wahaPg = await startPostgres('pg-waha', secret(), false);
  const spikePassword = secret();
  const spikePg = await startPostgres('pg-messaging', spikePassword, true);
  await psql(spikePg, 'create database s5_messaging;');
  const pgPort = await hostPort(spikePg, 5432);

  const values: Record<string, string> = {
    S5_DATABASE_URL: `postgres://postgres:${spikePassword}@127.0.0.1:${pgPort}/s5_messaging`,
  };
  for (const name of NAMES) {
    const handle = newWahaHandle(PREFIX, name);
    await psql(
      wahaPg,
      `create role ${handle.dbRole} login createdb password '${handle.dbPassword}';`,
    );
    const spec = wahaSpec(
      PREFIX,
      handle,
      NETWORK,
      'pg-waha',
      `http://host.docker.internal:${listenPort}`,
    );
    await run(handle.container, spec.image, {
      aliases: [`waha-${name}`],
      ...(spec.env ? { env: spec.env } : {}),
      ...(spec.secretEnv ? { secretEnv: spec.secretEnv } : {}),
      publish: `${String(HOST_PORTS[name])}:3000`,
    });
    const port = await hostPort(handle.container, 3000);
    const url = `http://127.0.0.1:${port}`;
    await waitFor(`${handle.container} ping`, async () => (await fetch(`${url}/ping`)).ok);
    const prefix = `S5_WAHA_${name.toUpperCase()}`;
    values[`${prefix}_URL`] = url;
    values[`${prefix}_API_KEY`] = handle.apiKey;
    values[`${prefix}_HMAC_KEY`] = handle.hmacKey;
  }
  writeEnv(values);
  out(`up: ${NAMES.map((n) => `${PREFIX}-waha-${n}`).join(', ')}, ${spikePg}`);
  out(`wrote ${ENV_FILE}`);
}

/** Replaces the stack's values in .env.local and keeps every other line (the owner's numbers). */
function writeEnv(values: Record<string, string>) {
  const existing = readEnv();
  const merged: Record<string, string> = {
    S5_NUMBER_G: existing['S5_NUMBER_G'] ?? '',
    S5_NUMBER_P: existing['S5_NUMBER_P'] ?? '',
    S5_ADMIN_TOKEN: existing['S5_ADMIN_TOKEN'] ?? randomBytes(32).toString('base64url'),
    S5_VERIFY_KEY: existing['S5_VERIFY_KEY'] ?? randomBytes(32).toString('base64url'),
    S5_LISTEN_HOST: existing['S5_LISTEN_HOST'] ?? '127.0.0.1',
    S5_LISTEN_PORT: existing['S5_LISTEN_PORT'] ?? '3105',
    S5_ADMIN_PORT: existing['S5_ADMIN_PORT'] ?? '3106',
    ...existing,
    ...values,
  };
  const lines = [
    '# Manual-day settings (docs/spikes/s5-manual-checklist.md). Git-ignored: never commit,',
    '# never paste. Fill S5_NUMBER_G and S5_NUMBER_P yourself in E.164 (+90... or +963...).',
    ...Object.entries(merged).map(([k, v]) => `${k}=${v}`),
  ];
  writeFileSync(ENV_FILE, `${lines.join('\n')}\n`, { mode: 0o600 });
}

async function status() {
  const names = await running();
  if (names.length === 0) {
    out('the manual stack is down');
    return;
  }
  const ps = await docker([
    'ps',
    '-a',
    '--filter',
    `label=${LABEL}`,
    '--format',
    '{{.Names}}\t{{.Status}}',
  ]);
  out(ps.stdout.trim());
  const stats = await docker([
    'stats',
    '--no-stream',
    '--format',
    '{{.Name}}\tCPU {{.CPUPerc}}\tMEM {{.MemUsage}}',
    ...names,
  ]);
  out(stats.stdout.trim());
}

async function sessionStatus(url: string, apiKey: string, session: string): Promise<string> {
  const r = await fetch(`${url}/api/sessions/${session}`, {
    headers: { 'x-api-key': apiKey },
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) return `http ${String(r.status)}`;
  return ((await r.json()) as { status?: string }).status ?? 'unknown';
}

async function restart(name: string | undefined) {
  if (name !== 'platform' && name !== 'clinics') throw new Error('restart platform|clinics');
  const env = readEnv();
  const prefix = `S5_WAHA_${name.toUpperCase()}`;
  const url = env[`${prefix}_URL`];
  const apiKey = env[`${prefix}_API_KEY`];
  if (!url || !apiKey) throw new Error(`${prefix}_URL/API_KEY missing in .env.local`);
  const session = SESSIONS[name];
  out(`before: ${session} ${await sessionStatus(url, apiKey, session).catch(() => 'unreachable')}`);
  const started = Date.now();
  await docker(['restart', `${PREFIX}-waha-${name}`]);
  const restarted = Date.now();
  // A stack started before fixed ports gets a new random port on restart: follow it and record it.
  const current = `http://127.0.0.1:${await hostPort(`${PREFIX}-waha-${name}`, 3000)}`;
  if (current !== url) {
    writeEnv({ [`${prefix}_URL`]: current });
    out(`${prefix}_URL changed; .env.local updated: restart the service (manual-run.ts serve)`);
  }
  let last = '';
  await waitFor(
    `${session} WORKING`,
    async () => {
      last = await sessionStatus(current, apiKey, session).catch(() => 'unreachable');
      return last === 'WORKING';
    },
    300_000,
  ).catch(() => undefined);
  const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  out(
    `docker restart: ${s(restarted - started)}; ${session} ${last} after ${s(Date.now() - started)}`,
  );
}

/** Variants of a number that a log could hold: with and without `+`, and its last 7 digits. */
function numberTerms(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  return digits.length < 7 ? [] : [`+${digits}`, digits, digits.slice(-7)];
}

async function grepLogs() {
  const env = readEnv();
  const numbers = (['S5_NUMBER_G', 'S5_NUMBER_P'] as const).flatMap((k) =>
    numberTerms(env[k] ?? '').map((t, i) => ({
      label: `${k} ${['+E164', 'digits', 'last7'][i] ?? ''}`,
      t,
    })),
  );
  // A missing number would make the check pass without looking (0.3-S5c security review N3).
  if (numbers.length !== 6) throw new Error('S5_NUMBER_G and S5_NUMBER_P must both be set');
  const codes = existsSync(CODES_FILE)
    ? readFileSync(CODES_FILE, 'utf8').split(/\s+/).filter(Boolean)
    : [];
  const terms = [...numbers, ...codes.map((t, i) => ({ label: `code ${String(i + 1)}`, t }))];
  let total = 0;
  for (const name of NAMES) {
    const r = await docker(['logs', `${PREFIX}-waha-${name}`]);
    const log = `${r.stdout}\n${r.stderr}`;
    out(`${PREFIX}-waha-${name}: ${String(log.split('\n').length)} log lines`);
    for (const { label, t } of terms) {
      const count = log.split(t).length - 1;
      total += count;
      out(`  ${label}: ${String(count)}`);
    }
  }
  out(`${String(codes.length)} codes checked; total matches: ${String(total)}`);
  if (total === 0 && codes.length > 0) {
    rmSync(CODES_FILE);
    out('deleted the recorded codes');
  }
}

async function down() {
  const names = await running();
  if (names.length > 0) await docker(['rm', '-f', '-v', ...names]);
  await docker(['network', 'rm', NETWORK], { check: false });
  out(`removed ${String(names.length)} containers`);
}

const [command, arg] = process.argv.slice(2);
const commands: Record<string, () => Promise<void>> = {
  up,
  status,
  restart: () => restart(arg),
  'grep-logs': grepLogs,
  down,
};
const fn = command ? commands[command] : undefined;
if (!fn) {
  process.stderr.write(
    'usage: node scripts/run-stack.ts up|status|restart <name>|grep-logs|down\n',
  );
  process.exit(2);
}
await fn();
