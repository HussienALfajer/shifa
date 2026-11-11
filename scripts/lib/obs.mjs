// Pure core of `pnpm obs:*` (scripts/obs.mjs): the local observability stack in
// infra/observability (spec 0.2-09b, criteria 8 and 10). Every effect goes through `io`, so the
// tests run it with a fake runner and an in-memory file system.
//
// Secrets: generated once into a git-ignored .env, never printed, never on a command line. A
// child that needs one gets it in its environment only.
import { join } from 'node:path';

export const STACK_DIR = join('infra', 'observability');
export const ENV_PATH = join(STACK_DIR, '.env');
const COMPOSE_PATH = join(STACK_DIR, 'compose.yml');

/** Generated on the first `up` (32 random bytes each, hex). */
export const SECRET_KEYS = [
  'GLITCHTIP_SECRET_KEY',
  'GLITCHTIP_ADMIN_PASSWORD',
  'GLITCHTIP_DB_PASSWORD',
  'GLITCHTIP_API_TOKEN',
];
/** Written by the GlitchTip bootstrap. */
export const BOOTSTRAP_KEYS = ['GLITCHTIP_DSN'];
/** The bootstrap prints its result on one line after this marker (Django prints other noise). */
export const BOOTSTRAP_MARKER = 'SHIFA_OBS_BOOTSTRAP ';

const SECRET_BYTES = 32;
const GRAFANA_URL = 'http://127.0.0.1:3300';
const GLITCHTIP_URL = 'http://127.0.0.1:8000';
export const GLITCHTIP_ORG = 'shifa-local';
export const GLITCHTIP_PROJECT = 'shifa-api';
const ADMIN_EMAIL = 'admin@shifa.localhost';
const REQUIRED_SERVICES = ['collector', 'lgtm', 'glitchtip-web', 'glitchtip-worker'];

/** Creates the admin, organisation, project and API token once; prints the project's DSN. */
const BOOTSTRAP_PY = `
import json, os
from django.contrib.auth import get_user_model
from apps.organizations_ext.models import Organization
from apps.projects.models import Project, ProjectKey
from apps.api_tokens.models import APIToken
User = get_user_model()
user = User.objects.filter(email=${JSON.stringify(ADMIN_EMAIL)}).first()
if user is None:
    user = User.objects.create_superuser(email=${JSON.stringify(ADMIN_EMAIL)}, password=os.environ["OBS_ADMIN_PASSWORD"])
org = Organization.objects.filter(slug=${JSON.stringify(GLITCHTIP_ORG)}).first()
if org is None:
    org = Organization.objects.create(name=${JSON.stringify(GLITCHTIP_ORG)}, slug=${JSON.stringify(GLITCHTIP_ORG)})
    org.add_user(user)  # the first user of an organisation becomes its owner
project = Project.objects.filter(organization=org, slug=${JSON.stringify(GLITCHTIP_PROJECT)}).first()
if project is None:
    project = Project.objects.create(organization=org, name=${JSON.stringify(GLITCHTIP_PROJECT)}, slug=${JSON.stringify(GLITCHTIP_PROJECT)})
key = ProjectKey.objects.filter(project=project).first() or ProjectKey.objects.create(project=project)
token = os.environ["OBS_API_TOKEN"]
if not APIToken.objects.filter(token=token).exists():
    api_token = APIToken(user=user, token=token, label="shifa obs smoke (read only)")
    for scope in ("org:read", "project:read", "event:read"):
        setattr(api_token.scopes, scope, True)
    api_token.save()
dsn = "http://%s@127.0.0.1:8000/%s" % (key.public_key.hex, project.id)
print(${JSON.stringify(BOOTSTRAP_MARKER)} + json.dumps({"dsn": dsn}))
`;

/** `KEY=value` lines; blank lines and `#` comments ignored. */
export function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function formatEnv(env) {
  const header =
    '# Local observability stack (pnpm obs:up). Generated; never commit or share this file.\n';
  return (
    header +
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}\n`)
      .join('')
  );
}

const compose = (io, ...args) => [
  'compose',
  '-f',
  join(io.root, COMPOSE_PATH),
  '--env-file',
  join(io.root, ENV_PATH),
  ...args,
];

function readEnv(io) {
  const text = io.readFile(join(io.root, ENV_PATH));
  return text === undefined ? undefined : parseEnv(String(text));
}

function writeEnv(io, env) {
  io.writeFile(join(io.root, ENV_PATH), formatEnv(env), 0o600);
}

async function up(io) {
  let env = readEnv(io);
  if (env === undefined) {
    env = Object.fromEntries(
      SECRET_KEYS.map((key) => [key, io.randomBytes(SECRET_BYTES).toString('hex')]),
    );
    writeEnv(io, env);
    io.out(`obs: generated ${ENV_PATH} (secrets stay in that file)`);
  }
  const missing = SECRET_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    io.out(`obs: ${ENV_PATH} lacks ${missing.join(', ')}; run pnpm obs:reset --yes`);
    return 1;
  }
  io.out('obs: starting the stack (first run pulls images; this can take minutes)');
  const started = await io.run('docker', compose(io, 'up', '-d', '--wait'));
  if (started.code !== 0) {
    io.out('obs: docker compose up failed');
    return 1;
  }
  if (!env.GLITCHTIP_DSN) {
    const result = await io.run(
      'docker',
      compose(
        io,
        'exec',
        '-T',
        '-e',
        'OBS_ADMIN_PASSWORD',
        '-e',
        'OBS_API_TOKEN',
        'glitchtip-web',
        './manage.py',
        'shell',
        '-c',
        BOOTSTRAP_PY,
      ),
      {
        capture: true,
        env: {
          OBS_ADMIN_PASSWORD: env.GLITCHTIP_ADMIN_PASSWORD,
          OBS_API_TOKEN: env.GLITCHTIP_API_TOKEN,
        },
      },
    );
    const line = result.stdout.split('\n').find((l) => l.startsWith(BOOTSTRAP_MARKER));
    const dsn = line ? JSON.parse(line.slice(BOOTSTRAP_MARKER.length)).dsn : undefined;
    if (result.code !== 0 || typeof dsn !== 'string') {
      io.out(
        'obs: the GlitchTip bootstrap failed (run pnpm obs:up again; see docker compose logs)',
      );
      return 1;
    }
    writeEnv(io, { ...env, GLITCHTIP_DSN: dsn });
    io.out(`obs: GlitchTip organisation ${GLITCHTIP_ORG}, project ${GLITCHTIP_PROJECT} ready`);
  }
  io.out(`obs: Grafana   ${GRAFANA_URL}`);
  io.out(`obs: GlitchTip ${GLITCHTIP_URL} (user ${ADMIN_EMAIL}, password in ${ENV_PATH})`);
  return 0;
}

async function smoke(io) {
  const env = readEnv(io);
  if (!env?.GLITCHTIP_DSN || !env.GLITCHTIP_API_TOKEN) {
    io.out(`obs: no bootstrapped ${ENV_PATH}; run pnpm obs:up first`);
    return 1;
  }
  const ps = await io.run('docker', compose(io, 'ps', '--status', 'running', '--services'), {
    capture: true,
  });
  const running = new Set(ps.stdout.split(/\r?\n/).map((s) => s.trim()));
  const down = REQUIRED_SERVICES.filter((service) => !running.has(service));
  if (ps.code !== 0 || down.length > 0) {
    io.out(`obs: the stack is not running (${down.join(', ') || 'docker'}); run pnpm obs:up`);
    return 1;
  }
  const build = await io.run('pnpm', ['--filter', '@shifa/api', 'build']);
  if (build.code !== 0) return 1;
  const check = await io.run('pnpm', ['--filter', '@shifa/api', 'obs-smoke'], {
    env: {
      OBS_SENTRY_DSN: env.GLITCHTIP_DSN,
      OBS_GLITCHTIP_TOKEN: env.GLITCHTIP_API_TOKEN,
      OBS_GLITCHTIP_URL: GLITCHTIP_URL,
      OBS_GLITCHTIP_ORG: GLITCHTIP_ORG,
      OBS_GLITCHTIP_PROJECT: GLITCHTIP_PROJECT,
      OBS_OTLP_ENDPOINT: 'http://127.0.0.1:4318',
      OBS_TEMPO_URL: 'http://127.0.0.1:3200',
      OBS_LOKI_URL: 'http://127.0.0.1:3100',
      OBS_PROMETHEUS_URL: 'http://127.0.0.1:9090',
    },
  });
  return check.code === 0 ? 0 : 1;
}

const USAGE = 'usage: pnpm obs:up | obs:down | obs:reset --yes | obs:smoke';

/** Runs one `obs` command; resolves to the process exit code. */
export async function obs(argv, io) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'up':
      return up(io);
    case 'down': {
      const result = await io.run('docker', compose(io, 'down'));
      return result.code === 0 ? 0 : 1;
    }
    case 'reset': {
      if (!rest.includes('--yes')) {
        io.out('obs: reset deletes all stored telemetry and the generated secrets.');
        io.out('obs: run pnpm obs:reset --yes to confirm');
        return 1;
      }
      const result = await io.run('docker', compose(io, 'down', '-v'));
      if (result.code !== 0) return 1;
      io.removeFile(join(io.root, ENV_PATH));
      io.out(`obs: stack, volumes and ${ENV_PATH} removed`);
      return 0;
    }
    case 'smoke':
      return smoke(io);
    default:
      io.out(USAGE);
      return 2;
  }
}
