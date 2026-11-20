// Screenshot comparison of every story (spec 0.4 criterion 9, slice 0.4-03).
//   pnpm --filter @shifa/ui screenshots             compare with screenshots/baselines/
//   pnpm --filter @shifa/ui screenshots --update    write the baselines (commit them)
// Needs the built Storybook (`storybook:build`) and Docker. The browser runs inside the pinned
// Playwright image (scripts/screenshot-image.ts) as `playwright run-server`; Playwright Test on
// this machine connects to it, and the image reaches the Storybook served here through the
// connection, so the pixels come from the image on every machine. Without Docker (the
// sandboxed WSL2 session, OD-24) run the `ui-baselines` workflow instead.
// The server is the lockfile-pinned playwright-core of this checkout, mounted read-only (nothing
// is downloaded in the container), run as the image's unprivileged user with no capabilities,
// behind a random path, and stopped on every exit.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PLAYWRIGHT_IMAGE, PLAYWRIGHT_VERSION } from './screenshot-image.ts';

const pkg = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const update = args.includes('--update');
if (args.some((a) => a !== '--update')) {
  process.stderr.write(`screenshots: unknown argument (use --update or none): ${args.join(' ')}\n`);
  process.exit(2);
}

class Failure extends Error {}

const docker = (dockerArgs: string[]) => spawnSync('docker', dockerArgs, { encoding: 'utf8' });

/** The playwright-core the lockfile installed (playwright's own dependency, same version). */
function playwrightCore(): string {
  const fromPlaywright = createRequire(
    createRequire(join(pkg, 'package.json')).resolve('playwright/package.json'),
  );
  const dir = realpathSync(dirname(fromPlaywright.resolve('playwright-core/package.json')));
  const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
    version: string;
  };
  if (version !== PLAYWRIGHT_VERSION) {
    throw new Failure(
      `playwright-core ${version} is installed, the image is ${PLAYWRIGHT_VERSION}`,
    );
  }
  return dir;
}

let container: string | null = null;
function stop() {
  if (container === null) return;
  docker(['stop', '--time', '2', container]);
  container = null;
}
process.on('exit', stop);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stop();
    process.exit(130);
  });
}

async function main(): Promise<number> {
  const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8')) as {
    devDependencies: Record<string, string>;
  };
  if (manifest.devDependencies['playwright'] !== PLAYWRIGHT_VERSION) {
    throw new Failure(
      `the image is Playwright ${PLAYWRIGHT_VERSION} but packages/ui pins another playwright`,
    );
  }
  if (!existsSync(join(pkg, 'storybook-static', 'index.json'))) {
    throw new Failure('no built Storybook; run `pnpm --filter @shifa/ui storybook:build` first');
  }
  if (docker(['version', '--format', '{{.Server.Version}}']).status !== 0) {
    throw new Failure(
      'Docker is not running; it holds the pinned browser (or run the ui-baselines workflow)',
    );
  }
  const secret = `/${randomUUID()}`;
  const started = docker([
    'run',
    '--detach',
    '--rm',
    '--init',
    '--user',
    'pwuser',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--volume',
    `${playwrightCore()}:/pw:ro`,
    '--publish',
    '127.0.0.1::3000',
    PLAYWRIGHT_IMAGE,
    'node',
    '/pw/cli.js',
    'run-server',
    '--port',
    '3000',
    '--host',
    '0.0.0.0',
    '--path',
    secret,
  ]);
  if (started.status !== 0)
    throw new Failure(`could not start the browser image:\n${started.stderr}`);
  container = started.stdout.trim();

  const mapped = docker(['port', container, '3000/tcp']).stdout.trim().split('\n')[0] ?? '';
  const port = /:(\d+)$/.exec(mapped)?.[1];
  if (port === undefined) throw new Failure(`no published port for the browser (${mapped})`);
  // The server answers any HTTP request once it listens.
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      break;
    } catch {
      if (Date.now() > deadline)
        throw new Failure('the browser server did not start within a minute');
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  const run = spawnSync(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '--config',
      'screenshots/playwright.config.ts',
      ...(update ? ['--update-snapshots=all'] : []),
    ],
    {
      cwd: pkg,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, SHIFA_PW_WS: `ws://127.0.0.1:${port}${secret}` },
    },
  );
  return run.status ?? 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  if (!(error instanceof Failure)) throw error;
  process.stderr.write(`screenshots: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  stop();
}
