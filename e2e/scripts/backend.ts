// The journeys' backend (slice A-01-06), run with plain Node by global-setup.ts (Playwright's own
// loader does not run the API's start script): the @shifa/db harness container (PostgreSQL 18,
// roles, migrations) under a DB test slot, the built API through api-process.ts, and `vite
// preview` of both built apps with /api proxied to that API. When everything answers it writes
// one READY line (URLs and seed, to the parent's pipe only) and runs until its stdin closes; then,
// or when a step of the start fails, it stops all of it.
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { acquireDbTestLock, startHarnessContainer } from '@shifa/db/harness';
import { type PreviewServer, preview } from 'vite';
import {
  freePort,
  MAIN,
  setIdentityEnv,
  startApi,
  waitReady,
} from '../../apps/api/scripts/api-process.ts';
import { READY_PREFIX, type RunUrls, type Seeded } from '../support/run.ts';
import { seed } from './seed.ts';

const appDir = (name: string) => fileURLToPath(new URL(`../../apps/${name}/`, import.meta.url));
const say = (line: string) => process.stderr.write(`e2e backend: ${line}\n`);

async function previewApp(name: string, port: number, apiUrl: string): Promise<PreviewServer> {
  const root = appDir(name);
  if (!existsSync(`${root}dist/index.html`)) {
    throw new Error(`apps/${name}/dist is missing: build first (verify runs the build step)`);
  }
  // Read by @shifa/web-shell/vite when it builds the proxy rule.
  process.env['SHIFA_API_URL'] = apiUrl;
  return preview({ root, logLevel: 'warn', preview: { port, strictPort: true, open: false } });
}

const stops: (() => Promise<unknown>)[] = [];
async function stopAll(): Promise<void> {
  for (const stop of stops.splice(0).reverse()) await stop().catch(() => undefined);
}

async function start(): Promise<{ run: RunUrls; seeded: Seeded }> {
  if (!existsSync(MAIN)) throw new Error('apps/api/dist is missing: build first');
  const release = await acquireDbTestLock();
  stops.push(() => {
    release();
    return Promise.resolve();
  });
  const harness = await startHarnessContainer();
  stops.push(() => harness.stop());

  const [apiPort, clinicPort, adminPort] = [await freePort(), await freePort(), await freePort()];
  // Two hosts, so each app keeps its own cookie jar (cookies ignore the port).
  const clinic = `http://localhost:${String(clinicPort)}`;
  const admin = `http://127.0.0.1:${String(adminPort)}`;
  const api = `http://127.0.0.1:${String(apiPort)}`;

  setIdentityEnv({
    DATABASE_URL_AUTH: harness.url('auth'),
    DATABASE_URL_PLATFORM: harness.url('platform'),
    BETTER_AUTH_SECRET: randomBytes(36).toString('base64'),
    AUTH_HMAC_KEY: randomBytes(36).toString('base64'),
  });
  const app = startApi(harness.url('app'), apiPort, { CLINIC_WEB_URL: clinic });
  stops.push(async () => {
    app.child.kill('SIGTERM');
    await Promise.race([app.exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
    app.child.kill('SIGKILL');
  });
  try {
    await waitReady(apiPort, app);
  } catch (err) {
    // The API's log names no secret (the boot check proves it); it explains the failure.
    process.stderr.write(app.output());
    throw err;
  }
  say('API ready');

  const clinicServer = await previewApp('clinic-web', clinicPort, api);
  stops.push(() => clinicServer.close());
  const adminServer = await previewApp('admin-web', adminPort, api);
  stops.push(() => adminServer.close());
  say('apps ready');

  const seeded = await seed({
    auth: harness.url('auth'),
    platform: harness.url('platform'),
    clinicWebUrl: clinic,
  });
  return { run: { clinic, admin, api, database: harness.url('superuser') }, seeded };
}

try {
  const ready = await start();
  process.stdout.write(`${READY_PREFIX}${JSON.stringify(ready)}\n`);
  process.stdin.resume();
  await new Promise((resolve) => process.stdin.once('end', resolve));
} catch (err) {
  say(err instanceof Error ? `${err.name}: ${err.message}` : 'start failed');
  process.exitCode = 1;
} finally {
  await stopAll();
  say('stopped');
}
