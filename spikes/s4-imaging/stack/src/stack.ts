// The imaging stack for one test file (criteria 1–6): three networks, PostgreSQL, Garage, one
// Orthanc per tenant, the gateway and the link. Orthanc, PostgreSQL and Garage live only on the
// internal `orthanc` network; the gateway bridges `cloud` and `orthanc`; the link bridges
// `clinic` and `cloud`, so every clinic-side byte crosses the shaper.
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SignJWT } from 'jose';
import { gatewayImage, linkImage } from './build.ts';
import { createNetwork, execIn, hostPort, removeRun, runContainer } from './containers.ts';
import { docker, waitFor } from './docker.ts';
import { startGarage } from './garage.ts';
import { IMAGES } from './images.ts';
import { createLink } from './link.ts';
import { type OrthancTenant, startOrthanc, waitOrthanc, writeOrthancFiles } from './orthanc.ts';
import { startPostgres } from './postgres.ts';
import type { GatewayMetrics, Stack, StackOptions, TenantHandle } from './types.ts';

const TENANTS = ['a', 'b'] as const;
const secret = () => randomBytes(24).toString('hex');

// Byte sink behind the link (link tests): counts uploads, serves downloads, answers pings.
const SINK = `
require('node:http').createServer((req, res) => {
  const url = new URL(req.url, 'http://sink');
  if (url.pathname === '/upload') {
    let bytes = 0;
    req.on('data', (c) => { bytes += c.length; });
    req.on('end', () => res.end(JSON.stringify({ bytes })));
  } else if (url.pathname === '/download') {
    const total = Number(url.searchParams.get('bytes'));
    const chunk = Buffer.alloc(65536, 7);
    res.setHeader('content-length', String(total));
    let sent = 0;
    const pump = () => {
      while (sent < total) {
        const n = Math.min(chunk.length, total - sent);
        sent += n;
        if (!res.write(n === chunk.length ? chunk : chunk.subarray(0, n))) return res.once('drain', pump);
      }
      res.end();
    };
    pump();
  } else res.end('ok');
}).listen(9000);
`;

// Test access to the cloud side (ops): Orthanc REST, Garage S3 and PostgreSQL, 127.0.0.1 only.
const opsConfig = () => `global
  maxconn 1024
resolvers docker
  nameserver dns 127.0.0.11:53
  hold valid 1s
defaults
  mode tcp
  timeout connect 10s
  timeout client 1h
  timeout server 1h
${[
  ['orthanc-a', 8042, 18042],
  ['orthanc-b', 8042, 18043],
  ['garage', 3900, 13900],
  ['postgres', 5432, 15432],
]
  .map(
    ([host, port, local]) => `frontend f-${String(host)}
  bind :${String(local)}
  default_backend b-${String(host)}
backend b-${String(host)}
  server s ${String(host)}:${String(port)} resolvers docker init-addr last,libc,none`,
  )
  .join('\n')}
`;

export async function startStack(options: StackOptions = {}): Promise<Stack> {
  const { profile = 'none', ops = true, browser = false, sink = false } = options;
  const runId = randomBytes(4).toString('hex');
  const name = (role: string) => `s4-${runId}-${role}`;
  const runDir = await mkdtemp(join(tmpdir(), `s4-${runId}-`));
  const containers: string[] = [];
  const started = (c: string) => {
    containers.push(c);
    return c;
  };
  try {
    const [clinic, cloud, orthancNet] = await Promise.all([
      createNetwork(name('clinic'), runId, { internal: false }),
      createNetwork(name('cloud'), runId, { internal: true }),
      createNetwork(name('orthanc'), runId, { internal: true }),
    ]);
    const builds = Promise.all([gatewayImage(), linkImage()]);
    // Awaited below; a handler now so an early build failure is not an unhandled rejection.
    builds.catch(() => undefined);

    const superPassword = secret();
    const tenantSecrets = TENANTS.map((id) => ({ id, db: secret(), http: secret() }));
    const gatewayDbPassword = secret();
    const [postgres, garage] = await Promise.all([
      startPostgres({
        name: name('postgres'),
        runId,
        network: orthancNet,
        superPassword,
        roles: [
          ...tenantSecrets.map((t) => ({ name: `orthanc_${t.id}`, password: t.db })),
          { name: 's4_gateway', password: gatewayDbPassword },
        ],
      }).then(started),
      startGarage({ name: name('garage'), runId, network: orthancNet, runDir }),
    ]);
    started(garage.container);

    const masterKeys = new Map<string, Buffer>();
    const orthancTenants = new Map<string, OrthancTenant>();
    const keyFiles = new Map<string, string>();
    await Promise.all(
      tenantSecrets.map(async (t) => {
        const bucket = `s4-${t.id}`;
        const tenant: OrthancTenant = {
          id: t.id,
          database: `orthanc_${t.id}`,
          dbPassword: t.db,
          httpPassword: t.http,
          bucket,
          s3: await garage.tenantBucket(bucket),
        };
        const key = randomBytes(32);
        masterKeys.set(t.id, key);
        orthancTenants.set(t.id, tenant);
        const files = await writeOrthancFiles(runDir, tenant, key);
        keyFiles.set(t.id, files.key);
        started(
          await startOrthanc({
            name: name(`orthanc-${t.id}`),
            runId,
            tenant,
            network: orthancNet,
            files,
          }),
        );
      }),
    );

    const [gatewayTag, linkTag] = await builds;
    const tokenKey = randomBytes(32);
    const upstreams = Object.fromEntries(
      [...orthancTenants.values()].map((t) => [
        t.id,
        {
          url: `http://orthanc-${t.id}:8042`,
          authorization: `Basic ${Buffer.from(`gateway:${t.httpPassword}`).toString('base64')}`,
        },
      ]),
    );
    const gateway = started(
      await runContainer({
        name: name('gateway'),
        runId,
        image: gatewayTag,
        networks: [
          { network: cloud, aliases: ['gateway'] },
          { network: orthancNet, aliases: ['gateway'] },
        ],
        env: { PORT: '8080', METRICS_PORT: '9091' },
        secretEnv: {
          S4_TOKEN_KEY: tokenKey.toString('base64'),
          S4_UPSTREAMS: JSON.stringify(upstreams),
          S4_DATABASE_URL: `postgres://s4_gateway:${gatewayDbPassword}@postgres:5432/s4_gateway`,
        },
      }),
    );

    const link = started(
      await runContainer({
        name: name('link'),
        runId,
        image: linkTag,
        networks: [
          { network: clinic, aliases: ['link'] },
          { network: cloud, aliases: ['link'] },
        ],
        capAdd: ['NET_ADMIN'],
        publish: [8080, 9000],
      }),
    );
    if (sink) {
      started(
        await runContainer({
          name: name('sink'),
          runId,
          image: IMAGES.node,
          networks: [{ network: cloud, aliases: ['sink'] }],
          command: ['node', '-e', SINK],
        }),
      );
    }
    const gatewayUrl = `http://${await hostPort(link, 8080)}`;
    await waitFor(
      'gateway through the link',
      async () => (await fetch(`${gatewayUrl}/healthz`)).ok,
      120_000,
    );

    let opsBase = '';
    if (ops) {
      const opsNet = await createNetwork(name('ops'), runId, { internal: false });
      const config = join(runDir, 'ops.cfg');
      await writeFile(config, opsConfig());
      const opsContainer = started(
        await runContainer({
          name: name('ops'),
          runId,
          image: linkTag,
          networks: [{ network: orthancNet }, { network: opsNet }],
          env: { LINK_CONFIG: '/etc/ops/haproxy.cfg' },
          mounts: [[config, '/etc/ops/haproxy.cfg']],
          publish: [18042, 18043, 13900, 15432],
        }),
      );
      opsBase = opsContainer;
    }
    const opsUrl = async (port: number) =>
      ops ? `http://${await hostPort(opsBase, port)}` : 'http://ops-disabled';

    let browserHandle: Stack['browser'];
    if (browser) {
      const container = started(
        await runContainer({
          name: name('browser'),
          runId,
          image: IMAGES.playwright,
          networks: [{ network: clinic, aliases: ['browser'] }],
          publish: [3000],
          command: [
            'npx',
            '-y',
            'playwright@1.65.1',
            'run-server',
            '--port',
            '3000',
            '--host',
            '0.0.0.0',
          ],
        }),
      );
      const wsEndpoint = `ws://${await hostPort(container, 3000)}/`;
      await waitFor(
        'playwright server',
        async () => (await fetch(wsEndpoint.replace('ws:', 'http:'))).status > 0,
        300_000,
      );
      browserHandle = { container, wsEndpoint };
    }

    const tenantHandle = async (id: string): Promise<TenantHandle> => {
      const t = orthancTenants.get(id);
      if (!t) throw new Error(`no tenant ${id}`);
      return {
        id,
        orthancUrl: await opsUrl(id === 'a' ? 18042 : 18043),
        orthancAuth: upstreams[id]?.authorization ?? '',
        bucket: t.bucket,
        s3: t.s3,
        database: t.database,
        container: name(`orthanc-${id}`),
      };
    };
    const linkHandle = await createLink({
      container: link,
      cloudNetwork: cloud,
      clinicNetwork: clinic,
      ...(sink ? { sinkUrl: `http://${await hostPort(link, 9000)}` } : {}),
    });
    if (profile !== 'none') await linkHandle.applyProfile(profile);

    const pgUrl = ops
      ? `postgres://postgres:${superPassword}@${(await opsUrl(15432)).slice(7)}/postgres`
      : '';
    const stack: Stack = {
      runId,
      gatewayUrl,
      clinicGatewayUrl: 'http://link:8080',
      tenants: { a: await tenantHandle('a'), b: await tenantHandle('b') },
      garage: {
        container: garage.container,
        s3Url: await opsUrl(13900),
        region: 'garage',
        cli: (...args: string[]) => garage.cli(...args),
      },
      postgres: { container: postgres, url: pgUrl },
      gateway: {
        container: gateway,
        metrics: async () => {
          const out = await execIn(gateway, [
            'node',
            '-e',
            "fetch('http://127.0.0.1:9091/metrics').then((r) => r.text()).then((t) => process.stdout.write(t))",
          ]);
          return JSON.parse(out.stdout) as GatewayMetrics;
        },
      },
      link: linkHandle,
      ...(browserHandle ? { browser: browserHandle } : {}),
      networks: { clinic, cloud, orthanc: orthancNet },
      tokenKey,
      token: async ({ sub = 'spike-user', tenant, role, ttlSeconds = 300 }) => {
        const payload = {
          sub,
          ...(tenant === undefined ? {} : { tenant }),
          ...(role === undefined ? {} : { role }),
        };
        return new SignJWT(payload)
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
          .sign(tokenKey);
      },
      restartOrthanc: async (tenant, { masterKey }) => {
        const container = name(`orthanc-${tenant}`);
        const keyFile = keyFiles.get(tenant);
        const key = masterKeys.get(tenant);
        const t = orthancTenants.get(tenant);
        if (!keyFile || !key || !t) throw new Error(`no tenant ${tenant}`);
        await docker(['stop', container]);
        // Same file (bind mount), new content: a wrong key of the right length.
        await writeFile(
          keyFile,
          (masterKey === 'current' ? key : randomBytes(32)).toString('base64'),
        );
        await docker(['start', container]);
        await waitOrthanc(container, t.httpPassword);
      },
      logs: async (container) => {
        const out = await docker(['logs', container], { check: false });
        return out.stdout + out.stderr;
      },
      containers: () => [...containers],
      stop: async () => {
        await removeRun(runId);
        await rm(runDir, { recursive: true, force: true });
      },
    };
    return stack;
  } catch (error) {
    // S4_KEEP=1 leaves a failed run's containers for `docker logs` (removed by the next run).
    if (process.env['S4_KEEP'] === '1') throw error;
    await removeRun(runId);
    await rm(runDir, { recursive: true, force: true });
    throw error;
  }
}
